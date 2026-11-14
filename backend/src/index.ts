import {createServer} from 'node:http'
import {Server} from 'socket.io'
import {
    Ack,
    ClientEvents,
    ClientToServerEvents,
    HIDDEN,
    RoomState,
    ServerEvents,
    ServerToClientEvents,
} from '../../spec/types'
import {generateAvatar} from './utils'
import {generateSeed} from './seed'
import * as config from './config'
import {RateLimiter} from 'limiter'
import * as parser from './parser'
import {load} from './store'
import {RoomBusy, RoomData, RoomGone} from './store/types'
import {loadAdapter} from './adapter'

const rooms = load()
await rooms.init()

const adapter = loadAdapter()

let ready = true

// Disconnect handlers still running, awaited on shutdown so that users are marked offline before exiting
const disconnecting = new Set<Promise<void>>()

// Probes for Kubernetes (socket.io handles its own path before these)
const http = createServer(async (req, res) => {
    try {
        if (req.url === '/healthz') return res.writeHead(200).end('ok')
        if (req.url === '/readyz') {
            const ok = ready && (await rooms.health())
            return res.writeHead(ok ? 200 : 503).end(ok ? 'ok' : 'not ready')
        }
        res.writeHead(404).end()
    } catch (e) {
        console.log(e)
        res.writeHead(500).end()
    }
})

type SocketData =
    | {
          ok: true
          id: string
          user: string
          room: string
          session: string
          avatar: string
      }
    | {ok: false; id: string; room?: never; user?: never; session?: never; avatar?: never}

type Me = {room: string; user: string}

const io = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(http, {
    path: config.path,
    // WebSocket only: long-polling would require sticky sessions when running multiple servers
    transports: ['websocket'],
    adapter: adapter.adapter,
    cors: {
        origin: config.origin,
    },
    // Disconnects are no longer destructive (users go offline and keep their vote), so be lenient with mobile networks
    pingInterval: 10000,
    pingTimeout: 10000,
})

// @ts-ignore
io.on('error', (err: Error) => {
    console.log('server', 'on', 'error', err)
})

/**
 * Converts the internal room into the state sent to clients: votes are only included if they are shown, except for
 * the vote of the recipient (if given).
 *
 * Comments are anonymous: they are only included once votes are shown, without their authors and sorted by content
 * (join or write order would reveal who wrote them). Whether someone commented is never sent.
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
        comments: data.hidden ? [] : Object.values(data.comments).sort((a, b) => a.localeCompare(b)),
        ...(recipient === undefined ? {} : {comment: data.comments[recipient] ?? ''}),
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

    socket.on(ClientEvents.HEALTH, async (ack: Ack) => {
        try {
            parser.ack(ack)
            ack({ok: await rooms.health()})
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

        // New user
        const user = {
            name: data.user,
            avatar: generateAvatar(),
        }

        // Update state
        const result = await rooms.join(
            data.room,
            user,
            {session: data.session, socket: socket.id},
            data.seed && config.seed ? generateSeed() : undefined
        )

        // Check if another user with same name exists
        if (!result.ok) {
            emitError(`User ${data.user} already exists ...`, () => socket.disconnect(true))
            return false
        }

        // Init metadata
        socket.data = {
            ok: true,
            id: socket.data.id,
            user: data.user,
            room: data.room,
            session: data.session,
            avatar: user.avatar,
        }

        // Join broadcast
        socket.join(data.room)

        // Disconnect previous sockets of a taken over user (e.g., another tab, stale connection)
        if (result.takeover) {
            const sockets = await io.in(data.room).fetchSockets()
            for (const other of sockets.filter(it => it.data.user === data.user && it.id !== socket.id)) {
                other.emit(ServerEvents.SHOW_NOTIFICATION, {message: 'You joined this room somewhere else ...'})
                other.disconnect(true)
            }
        }

        // Emit state
        emitState({room: data.room, user: data.user}, result.room)
    })

    onJoined(ClientEvents.SET_VOTE, async (input, me) => {
        const data = parser.setVote(input)

        // Update state (fails if the room is closed or the user has been removed)
        const room = await rooms.vote(me.room, me.user, data.vote)

        // Emit state
        emitState(me, room)
    })

    onJoined(ClientEvents.SET_COMMENT, async (input, me) => {
        const data = parser.setComment(input)

        // Update state (comments are only editable while votes are hidden)
        const room = await rooms.comment(me.room, me.user, data.comment)
        if (room === 'shown') {
            emitError('Comments can only be changed while votes are hidden ...')
            return false
        }

        // Emit state only to the author: while hidden, the public state did not change, and a broadcast would tell
        // others that someone commented right now (versions only need to increase, others catch up with the next change)
        emitOwnState(me, room)
    })

    onJoined(ClientEvents.SHOW_VOTES, async (_, me) => {
        const room = await rooms.setHidden(me.room, false)
        emitState(me, room)
    })

    onJoined(ClientEvents.HIDE_VOTES, async (_, me) => {
        const room = await rooms.setHidden(me.room, true)
        emitState(me, room)
    })

    onJoined(ClientEvents.INIT_STATE, async (_, me) => {
        const room = await rooms.getRoom(me.room)
        emitOwnState(me, room)
    })

    onJoined(ClientEvents.REMOVE_USER, async (input, me) => {
        const data = parser.removeUser(input)

        // Disconnect user
        const sockets = await io.in(me.room).fetchSockets()
        for (const target of sockets.filter(it => it.data.user === data.user)) {
            target.emit(ServerEvents.SHOW_NOTIFICATION, {message: `You have been removed by ${me.user} ...`})
            target.disconnect(true)
        }

        // Update state (the target's own disconnect handler might never run, e.g., for broken users)
        const room = await rooms.leave(me.room, data.user)
        emitState(me, room)
    })

    onJoined(ClientEvents.CLOSE_ROOM, async (_, me) => {
        // Update state
        await rooms.deleteRoom(me.room)

        // Emit close room to room (including this socket)
        console.log('server', me.room, 'emit', ServerEvents.CLOSE_ROOM)
        io.to(me.room).emit(ServerEvents.CLOSE_ROOM)

        // Disconnect all sockets by force
        io.in(me.room).disconnectSockets(true)

        return false
    })

    socket.on('disconnect', reason => {
        const pending = onDisconnect(reason).finally(() => disconnecting.delete(pending))
        disconnecting.add(pending)
    })

    async function onDisconnect(reason: string) {
        try {
            console.log('socket', socket.data.id, socket.data.room, 'on', 'disconnected', reason)

            // Assert
            if (!socket.data.ok) return
            const me = {room: socket.data.room, user: socket.data.user}

            // Reset data
            socket.data = {ok: false, id: socket.data.id}

            // Leaving on purpose (leave button, closing the room) removes the user. Otherwise (network, server
            // restart), the user stays offline with their vote and might reconnect within the grace period.
            const mode = reason === 'client namespace disconnect' ? 'leave' : 'offline'

            // Update state (no-op if the user has been taken over by another socket meanwhile)
            const room = await rooms.disconnect(me.room, me.user, socket.id, mode)
            if (!room) return

            // Emit state to room
            emitRoomState(me.room, room)

            // Remove the user once the grace period ended (if this server is gone by then, the next change does it)
            if (mode === 'offline') schedulePrune(me.room)
        } catch (e) {
            handleUnexpected(e)
        }
    }

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

    // Sends the current state to this socket, e.g., to reset its ballot after a vote which was not applied
    function emitOwnRoom() {
        if (!socket.data.ok) return
        const me = {room: socket.data.room, user: socket.data.user}
        rooms
            .getRoom(me.room)
            .then(room => emitOwnState(me, room))
            .catch(handleUnexpected)
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
        if (error instanceof RoomBusy) {
            emitError(error.message)
            return emitOwnRoom()
        }

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

function schedulePrune(room: string) {
    setTimeout(
        async () => {
            try {
                const data = await rooms.prune(room)
                if (!data) return
                console.log('server', room, 'emit', ServerEvents.ROOM_STATE, data.version)
                io.to(room).emit(ServerEvents.ROOM_STATE, toState(data))
            } catch (e) {
                console.log(e)
            }
        },
        (config.offlineGrace + 1) * 1000
    ).unref()
}

http.listen(config.port)

process.on('unhandledRejection', err => {
    console.log(err)
})

async function shutdown(signal: string) {
    try {
        console.log('server', 'on', signal)
        ready = false
        // Disconnected clients go offline and reconnect to another server, where they take over their user
        await io.close()
        await Promise.allSettled(disconnecting)
        await adapter.close()
        await rooms.close()
        process.exit(0)
    } catch (e) {
        console.log(e)
        process.exit(1)
    }
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
