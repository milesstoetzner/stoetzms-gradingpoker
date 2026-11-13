import {Server} from 'socket.io'
import {
    Ack,
    ClientEvents,
    ClientToServerEvents,
    HIDDEN,
    RoomState,
    ServerEvents,
    ServerToClientEvents,
    User,
} from '../../spec/types'
import {generateAvatar} from './utils'
import {generateSeed} from './seed'
import * as config from './config'
import {RateLimiter} from 'limiter'
import * as parser from './parser'
import {load} from './persistency'
import {RoomData, RoomGone} from './persistency/types'

const persistency = load()
await persistency.init()

type SocketData =
    | {
          ok: true
          id: string
          user: string
          room: string
          avatar: string
      }
    | {ok: false; id: string; room?: never; user?: never; avatar?: never}

type Me = {room: string; user: string}

const io = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>({
    path: config.path,
    // WebSocket only: long-polling would require sticky sessions when running multiple servers
    transports: ['websocket'],
    cors: {
        origin: config.origin,
    },
    pingInterval: 2000,
    pingTimeout: 2000,
})

// @ts-ignore
io.on('error', (err: Error) => {
    console.log('server', 'on', 'error', err)
})

/**
 * Converts the internal room into the state sent to clients: votes are only included if they are shown, except for
 * the vote of the recipient (if given).
 */
function toState(data: RoomData, recipient?: string): RoomState {
    const own = recipient === undefined ? undefined : data.votes[recipient]
    return {
        id: data.id,
        version: data.version,
        hidden: data.hidden,
        users: data.users,
        votes: !data.hidden ? data.votes : own === undefined ? {} : {[recipient!]: own},
        voted: Object.fromEntries(Object.keys(data.votes).map(user => [user, true])),
    }
}

class TooManyRequests extends Error {
    constructor() {
        super('Too many requests ...')
    }
}

io.on('connection', socket => {
    socket.data = {ok: false, id: socket.id}

    console.log('socket', socket.data.id, 'on', 'connected')

    const limiter = new RateLimiter({tokensPerInterval: 30, interval: 60 * 500, fireImmediately: true})

    /**
     * Registers a handler for a client event. The handler is logged, rate limited and acked (unless it returns false).
     * Errors (e.g., invalid input) are reported to the client.
     */
    function on(event: ClientEvents, handler: (input: unknown) => Promise<boolean | void>) {
        socket.on(event as any, async (...args: unknown[]) => {
            const ack = args[args.length - 1] as Ack
            const input = args.length > 1 ? args[0] : undefined

            try {
                console.log('socket', socket.data.id, socket.data.room, 'on', event, config.debug ? input : HIDDEN)
                parser.ack(ack)

                // Limit
                await limit()

                // Handle
                const ok = await handler(input)

                // Emit ack
                if (ok !== false) ack({ok: true})
            } catch (e) {
                handleUnexpected(e)
            }
        })
    }

    /**
     * Same as on, but only for sockets which joined a room.
     */
    function onJoined(event: ClientEvents, handler: (input: unknown, me: Me) => Promise<boolean | void>) {
        on(event, async input => {
            // Assert socket
            if (!socket.data.ok) {
                socket.disconnect(true)
                return false
            }

            return handler(input, {room: socket.data.room, user: socket.data.user})
        })
    }

    /**
     * Runs the function while holding the lock of the room. Changes must call persistency.bump once.
     */
    async function locked<T>(room: string, fn: () => Promise<T>): Promise<T> {
        const lock = await persistency.lock(room)
        try {
            return await fn()
        } finally {
            await lock.release()
        }
    }

    socket.on(ClientEvents.HEALTH, async (ack: Ack) => {
        try {
            parser.ack(ack)
            ack({ok: await persistency.health()})
        } catch (e) {
            handleUnexpected(e)
        }
    })

    on(ClientEvents.JOIN_ROOM, async input => {
        const data = parser.joinRoom(input)

        // Assert socket has not joined yet
        if (socket.data.ok) {
            emitError('Already joined a room ...')
            return false
        }

        return locked(data.room, async () => {
            // Assert room
            const exists = await persistency.hasRoom(data.room)
            if (!exists) await persistency.addRoom(data.room, data.seed && config.seed ? generateSeed() : undefined)

            // Check if another user with same name exists
            if (await persistency.hasUser(data.room, data.user)) {
                emitError(`User ${data.user} already exists ...`, () => socket.disconnect(true))
                return false
            }

            // New user
            const user: User = {
                name: data.user,
                avatar: generateAvatar(),
            }

            // Init metadata
            socket.data = {ok: true, id: socket.data.id, user: data.user, room: data.room, avatar: user.avatar}

            // Update state
            await persistency.addUser(data.room, user.name, user.avatar)
            await persistency.setHidden(data.room, true)
            await persistency.bump(data.room)

            // Join broadcast
            socket.join(data.room)

            // Emit state
            emitState({room: data.room, user: data.user}, await persistency.getRoom(data.room))
        })
    })

    onJoined(ClientEvents.SET_VOTE, async (input, me) => {
        const data = parser.setVote(input)

        return locked(me.room, async () => {
            // Assert room
            await persistency.assertRoom(me.room)

            // Assert user (might have been removed meanwhile)
            if (!(await persistency.hasUser(me.room, me.user))) return emitRoomGone()

            // Update state (voting hides votes)
            await persistency.setVote(me.room, me.user, data.vote)
            await persistency.setHidden(me.room, true)
            await persistency.bump(me.room)

            // Emit state
            emitState(me, await persistency.getRoom(me.room))
        })
    })

    onJoined(ClientEvents.SHOW_VOTES, async (_, me) => {
        return locked(me.room, async () => {
            await persistency.assertRoom(me.room)

            await persistency.setHidden(me.room, false)
            await persistency.bump(me.room)
            emitState(me, await persistency.getRoom(me.room))
        })
    })

    onJoined(ClientEvents.HIDE_VOTES, async (_, me) => {
        return locked(me.room, async () => {
            await persistency.assertRoom(me.room)

            await persistency.setHidden(me.room, true)
            await persistency.bump(me.room)
            emitState(me, await persistency.getRoom(me.room))
        })
    })

    onJoined(ClientEvents.INIT_STATE, async (_, me) => {
        return locked(me.room, async () => {
            await persistency.assertRoom(me.room)
            emitOwnState(me, await persistency.getRoom(me.room))
        })
    })

    onJoined(ClientEvents.REMOVE_USER, async (input, me) => {
        const data = parser.removeUser(input)

        return locked(me.room, async () => {
            await persistency.assertRoom(me.room)

            // Disconnect user
            const sockets = await io.in(me.room).fetchSockets()
            const target = sockets.find(it => it.data.user === data.user)
            if (target) {
                target.emit(ServerEvents.SHOW_NOTIFICATION, {message: `You have been removed by ${me.user} ...`})
                target.disconnect(true)
            }

            // Manually cleanup broken user (the target's own disconnect handler might never run)
            await persistency.removeUser(me.room, data.user)
            await persistency.removeVote(me.room, data.user)
            await persistency.bump(me.room)

            emitState(me, await persistency.getRoom(me.room))
        })
    })

    onJoined(ClientEvents.CLOSE_ROOM, async (_, me) => {
        return locked(me.room, async () => {
            await persistency.assertRoom(me.room)

            // Update state
            await persistency.deleteRoom(me.room)

            // Emit close room to room (including this socket)
            console.log('server', me.room, 'emit', ServerEvents.CLOSE_ROOM)
            io.to(me.room).emit(ServerEvents.CLOSE_ROOM)

            // Disconnect all sockets by force
            io.in(me.room).disconnectSockets(true)

            return false
        })
    })

    socket.on('disconnect', async reason => {
        try {
            console.log('socket', socket.data.id, socket.data.room, 'on', 'disconnected', reason)

            // Assert
            if (!socket.data.ok) return
            const me = {room: socket.data.room, user: socket.data.user}

            // Reset data
            socket.data = {ok: false, id: socket.data.id}

            await locked(me.room, async () => {
                if (!(await persistency.hasRoom(me.room))) return

                // Update state
                await persistency.removeUser(me.room, me.user)
                await persistency.removeVote(me.room, me.user)
                await persistency.bump(me.room)

                // Emit state to room
                emitRoomState(me.room, await persistency.getRoom(me.room))
            })
        } catch (e) {
            handleUnexpected(e)
        }
    })

    socket.on('error', (error: Error) => {
        console.log(socket.data.id, socket.data.room, 'on', 'error', error)
    })

    async function limit() {
        if (!limiter.tryRemoveTokens(1)) throw new TooManyRequests()
    }

    // Sends the state to this socket (including its own vote) and to all other sockets in the room
    function emitState(me: Me, room: RoomData) {
        emitOwnState(me, room)
        console.log('server', me.room, 'emit', ServerEvents.ROOM_STATE, room.version)
        socket.to(me.room).emit(ServerEvents.ROOM_STATE, toState(room))
    }

    function emitOwnState(me: Me, room: RoomData) {
        const state = toState(room, me.user)
        console.log('server', socket.data.id, 'emit', ServerEvents.ROOM_STATE, config.debug ? state : HIDDEN)
        socket.emit(ServerEvents.ROOM_STATE, state)
    }

    function emitRoomState(name: string, room: RoomData) {
        console.log('server', name, 'emit', ServerEvents.ROOM_STATE, room.version)
        io.to(name).emit(ServerEvents.ROOM_STATE, toState(room))
    }

    function emitRoomGone() {
        console.log('server', socket.data.id, 'emit', ServerEvents.CLOSE_ROOM)
        socket.emit(ServerEvents.CLOSE_ROOM)
        socket.disconnect(true)
        return false
    }

    function emitError(message: string, ack?: Ack): void {
        const emit = {message}
        console.log('server', socket.data.id, 'emit', ServerEvents.SHOW_NOTIFICATION, config.debug ? emit : HIDDEN)
        socket.emit(ServerEvents.SHOW_NOTIFICATION, emit, ack)
    }

    function handleUnexpected(error: unknown) {
        if (error instanceof TooManyRequests) return emitError(error.message)
        if (error instanceof RoomGone) return emitRoomGone()

        if (parser.isInvalidInput(error)) {
            const issue = error.issues[0]
            return emitError(`Invalid ${issue?.path.join('.') || 'input'}: ${issue?.message ?? 'unknown'}`)
        }

        console.log(error)

        if (socket.connected) {
            const emit = {message: 'Unexpected error on the server ...'}
            console.log('server', socket.data.id, 'emit', ServerEvents.SHOW_NOTIFICATION, config.debug ? emit : HIDDEN)
            socket.emit(ServerEvents.SHOW_NOTIFICATION, emit)
        }
    }
})

io.listen(config.port)

process.on('unhandledRejection', err => {
    console.log(err)
})

async function shutdown(signal: string) {
    try {
        console.log('server', 'on', signal)
        await io.close()
        await persistency.close()
        process.exit(0)
    } catch (e) {
        console.log(e)
        process.exit(1)
    }
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
