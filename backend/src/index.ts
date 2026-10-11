import {Server} from 'socket.io'
import {
    Ack,
    ClientEvents,
    ClientToServerEvents,
    HIDDEN,
    Room,
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
import {RoomGone} from './persistency/types'

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
     * Runs the function while holding the lock of the room.
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

            // Join broadcast
            socket.join(data.room)

            // Emit init state
            emitInitState(await persistency.getRoom(data.room))

            // Emit add user and hide votes to room
            console.log('server', data.room, 'emit', ServerEvents.ADD_USER, config.debug ? user : HIDDEN)
            socket.to(data.room).emit(ServerEvents.ADD_USER, user)
            console.log('server', data.room, 'emit', ServerEvents.HIDE_VOTES)
            socket.to(data.room).emit(ServerEvents.HIDE_VOTES)
        })
    })

    onJoined(ClientEvents.SET_VOTE, async (input, me) => {
        const data = parser.setVote(input)

        return locked(me.room, async () => {
            // Assert room
            await persistency.assertRoom(me.room)

            // Update state
            await persistency.setVote(me.room, me.user, data.vote)

            // Emit set vote to room
            const emit = {user: me.user}
            console.log('server', me.room, 'emit', ServerEvents.SET_VOTED, config.debug ? emit : HIDDEN)
            socket.to(me.room).emit(ServerEvents.SET_VOTED, emit)
        })
    })

    onJoined(ClientEvents.SHOW_VOTES, async (_, me) => {
        return locked(me.room, async () => {
            await persistency.assertRoom(me.room)

            await persistency.setHidden(me.room, false)
            const data = await persistency.getVotes(me.room)

            console.log('server', me.room, 'emit', ServerEvents.SHOW_VOTES, config.debug ? data : HIDDEN)
            io.to(me.room).emit(ServerEvents.SHOW_VOTES, data)
        })
    })

    onJoined(ClientEvents.HIDE_VOTES, async (_, me) => {
        return locked(me.room, async () => {
            await persistency.assertRoom(me.room)

            await persistency.setHidden(me.room, true)

            console.log('server', me.room, 'emit', ServerEvents.HIDE_VOTES)
            socket.to(me.room).emit(ServerEvents.HIDE_VOTES)
        })
    })

    onJoined(ClientEvents.INIT_STATE, async (_, me) => {
        return locked(me.room, async () => {
            await persistency.assertRoom(me.room)
            emitInitState(await persistency.getRoom(me.room))
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

            const emit = {user: data.user}
            console.log('server', me.room, 'emit', ServerEvents.REMOVE_USER, config.debug ? emit : HIDDEN)
            io.to(me.room).emit(ServerEvents.REMOVE_USER, emit)
        })
    })

    onJoined(ClientEvents.CLOSE_ROOM, async (_, me) => {
        return locked(me.room, async () => {
            await persistency.assertRoom(me.room)

            // Update state
            await persistency.deleteRoom(me.room)

            // Emit close room to the others (this socket receives the ack and leaves by itself)
            console.log('server', me.room, 'emit', ServerEvents.CLOSE_ROOM)
            socket.to(me.room).emit(ServerEvents.CLOSE_ROOM)

            // Disconnect the others by force
            io.in(me.room).except(socket.id).disconnectSockets(true)
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

                // Emit remove user to room
                const emit = {user: me.user}
                console.log('server', me.room, 'emit', ServerEvents.REMOVE_USER, config.debug ? emit : HIDDEN)
                io.to(me.room).emit(ServerEvents.REMOVE_USER, emit)
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

    function emitInitState(room: Room) {
        const init: Room = {
            hidden: room.hidden,
            users: room.users,
            votes: room.hidden ? ownVote(room) : room.votes,
            voted: room.voted,
        }
        console.log('server', socket.data.id, 'emit', ServerEvents.INIT_STATE, config.debug ? init : HIDDEN)
        socket.emit(ServerEvents.INIT_STATE, init)
    }

    function ownVote(room: Room) {
        const vote = socket.data.user ? room.votes[socket.data.user] : undefined
        return vote === undefined ? {} : {[socket.data.user!]: vote}
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
