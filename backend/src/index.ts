import {createServer} from 'node:http'
import {Server} from 'socket.io'
import {
    Ack,
    ClientEvents,
    ClientToServerEvents,
    HIDDEN,
    RoomEvent,
    RoomState,
    ServerEvents,
    ServerToClientEvents,
} from '../../spec/types'
import {generateSeed} from './seed'
import * as config from './config'
import {RateLimiter} from 'limiter'
import * as parser from './parser'
import {Rooms} from './store/rooms'
import {RoomData, RoomGone, StoreEvent} from './store/types'

const rooms = new Rooms(config.roomTtl, config.offlineGrace)
await rooms.init()

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
      }
    | {ok: false; id: string; room?: never; user?: never; session?: never}

type Me = {room: string; user: string}

const io = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(http, {
    path: config.path,
    // WebSocket only: long-polling would require sticky sessions when running multiple servers
    transports: ['websocket'],
    cors: config.origin ? {origin: config.origin} : undefined,
    // Disconnects are no longer destructive (users go offline and keep their vote), so be lenient with mobile networks
    pingInterval: 10000,
    pingTimeout: 10000,
})

// @ts-ignore
io.on('error', (err: Error) => {
    console.log('server', 'on', 'error', err)
})

/**
 * Converts the room into the state sent to the recipient: votes are only included if they are shown, except for the
 * vote of the recipient.
 *
 * Comments are anonymous: they are only included once votes are shown, without their authors and sorted by content
 * (join or write order would reveal who wrote them). Whether someone commented is never sent.
 */
function toState(data: RoomData, recipient: string): RoomState {
    const own = data.votes[recipient]
    return {
        id: data.id,
        version: data.version,
        hidden: data.hidden,
        users: data.users,
        votes: !data.hidden ? data.votes : own === undefined ? {} : {[recipient]: own},
        voted: Object.fromEntries(Object.keys(data.votes).map(user => [user, true])),
        comments: data.hidden ? [] : Object.values(data.comments).sort(),
        comment: data.comments[recipient] ?? '',
    }
}

/**
 * Rooms with sockets on this server. The server is subscribed to the events of exactly these rooms and forwards them
 * to its sockets, so a change reaches the clients of all servers without the servers knowing each other.
 */
const local = new Map<string, {sockets: Set<string>; subscribed: Promise<void>}>()

// Subscribes before the socket does anything in the room, so that no event is missed
async function enter(room: string, socket: string) {
    let entry = local.get(room)
    if (!entry) {
        entry = {sockets: new Set(), subscribed: rooms.subscribe(room)}
        local.set(room, entry)
    }
    entry.sockets.add(socket)
    await entry.subscribed
}

async function exit(room: string, socket: string) {
    const entry = local.get(room)
    if (!entry) return
    entry.sockets.delete(socket)
    if (entry.sockets.size) return

    local.delete(room)
    await rooms.unsubscribe(room)
}

function emitEvent(room: string, event: RoomEvent) {
    console.log('server', room, 'emit', ServerEvents.ROOM_EVENT, event.type, event.version)
    io.to(room).emit(ServerEvents.ROOM_EVENT, event)
}

function closeLocally(room: string) {
    console.log('server', room, 'emit', ServerEvents.CLOSE_ROOM)
    io.to(room).emit(ServerEvents.CLOSE_ROOM)
    io.in(room).disconnectSockets(true)
}

// Disconnects the sockets of a user on this server (except the given one)
function kick(room: string, user: string, message: string, except?: string) {
    for (const id of io.sockets.adapter.rooms.get(room) ?? []) {
        const socket = io.sockets.sockets.get(id)
        if (!socket || socket.id === except || socket.data.user !== user) continue
        socket.emit(ServerEvents.SHOW_NOTIFICATION, {message})
        socket.disconnect(true)
    }
}

// Redis encodes empty lists as objects
function list(value: unknown): string[] {
    return Array.isArray(value) ? value : []
}

rooms.onEvent((room: string, event: StoreEvent) => {
    const {id} = event
    switch (event.type) {
        case 'closed':
            return closeLocally(room)

        case 'takeover':
            // Previous sockets of the user (e.g., another tab, stale connection)
            kick(room, event.user, 'You joined this room somewhere else ...', event.socket)
            return emitEvent(room, {type: 'online', id, version: event.version, user: event.user})

        case 'left':
            if (event.by) kick(room, event.user, `You have been removed by ${event.by} ...`)
            return emitEvent(room, {
                type: 'left',
                id,
                version: event.version,
                user: event.user,
                ...(event.comments === undefined ? {} : {comments: list(event.comments)}),
            })

        case 'joined':
            return emitEvent(room, {type: 'joined', id, version: event.version, user: event.user})

        case 'shown':
            return emitEvent(room, {type: 'shown', id, version: event.version, votes: event.votes, comments: list(event.comments)})

        default:
            return emitEvent(room, event)
    }
})

/**
 * Heartbeat: tells the clients of every room on this server the current version of their room, so that a client
 * which missed the last change notices it. Also removes offline users whose grace period ended.
 */
async function heartbeat() {
    await Promise.allSettled(
        [...local.keys()].map(async room => {
            const current = await rooms.sync(room)
            if (!current) return closeLocally(room)
            io.to(room).emit(ServerEvents.ROOM_EVENT, {type: 'version', ...current})
        })
    )
}

const beat = setInterval(() => heartbeat().catch(console.log), config.heartbeat * 1000)
beat.unref()

// Events might have been missed while the subscription was interrupted
rooms.onRestored(() => heartbeat().catch(console.log))

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
        const me = {room: data.room, user: data.user}

        // Update state
        await enter(me.room, socket.id)
        let result
        try {
            result = await rooms.join(
                me.room,
                me.user,
                {session: data.session, socket: socket.id},
                data.seed && config.seed ? generateSeed() : undefined
            )
        } catch (e) {
            await exit(me.room, socket.id)
            throw e
        }

        // Check if another user with same name exists
        if (result === 'collision') {
            await exit(me.room, socket.id)
            emitError(`User ${data.user} already exists ...`, () => socket.disconnect(true))
            return false
        }

        // The socket is gone meanwhile, its disconnect handler did not know about the room yet
        if (!socket.connected) {
            await rooms.disconnect(me.room, me.user, socket.id, 'offline')
            await exit(me.room, socket.id)
            return false
        }

        // Init metadata
        socket.data = {ok: true, id: socket.data.id, user: me.user, room: me.room, session: data.session}

        // Receive the events of the room
        socket.join(me.room)

        // Emit state
        await emitOwnState(me)
    })

    onJoined(ClientEvents.SET_VOTE, async (input, me) => {
        const data = parser.setVote(input)

        // Fails if the room is closed or the user has been removed
        await rooms.vote(me.room, me.user, data.vote)
    })

    onJoined(ClientEvents.SET_COMMENT, async (input, me) => {
        const data = parser.setComment(input)

        // Comments are only editable while votes are hidden. Nobody else is told: that would reveal who commented
        if ((await rooms.comment(me.room, me.user, data.comment)) === 'shown') {
            emitError('Comments can only be changed while votes are hidden ...')
            return false
        }
    })

    onJoined(ClientEvents.SHOW_VOTES, async (_, me) => {
        await rooms.setHidden(me.room, false)
    })

    onJoined(ClientEvents.HIDE_VOTES, async (_, me) => {
        await rooms.setHidden(me.room, true)
    })

    onJoined(ClientEvents.INIT_STATE, async (_, me) => {
        await emitOwnState(me)
    })

    onJoined(ClientEvents.REMOVE_USER, async (input, me) => {
        const data = parser.removeUser(input)

        // The servers disconnect the sockets of the removed user
        await rooms.leave(me.room, data.user, me.user)
    })

    onJoined(ClientEvents.CLOSE_ROOM, async (_, me) => {
        // The servers tell and disconnect everyone in the room (including this socket)
        await rooms.deleteRoom(me.room)

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

            // Update state (no-op if the user has been taken over by another socket meanwhile). Offline users are
            // removed by the heartbeat once their grace period ended
            await rooms.disconnect(me.room, me.user, socket.id, mode)
            await exit(me.room, socket.id)
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

    // Sends the full state to this socket (including its own vote and comment)
    async function emitOwnState(me: Me) {
        const state = toState(await rooms.getRoom(me.room), me.user)
        console.log('server', socket.data.id, 'emit', ServerEvents.ROOM_STATE, config.debug ? state : HIDDEN)
        socket.emit(ServerEvents.ROOM_STATE, state)
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

http.listen(config.port)

process.on('unhandledRejection', err => {
    console.log(err)
})

async function shutdown(signal: string) {
    try {
        console.log('server', 'on', signal)
        ready = false
        // Disconnected clients go offline and reconnect to another server, where they take over their user
        clearInterval(beat)
        await io.close()
        await Promise.allSettled(disconnecting)
        await rooms.close()
        process.exit(0)
    } catch (e) {
        console.log(e)
        process.exit(1)
    }
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
