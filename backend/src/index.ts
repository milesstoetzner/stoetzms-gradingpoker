import {Server} from 'socket.io'
import {
    Ack,
    ClientEvents,
    ClientToServerEvents,
    HIDDEN,
    Room,
    JoinRoom,
    ServerEvents,
    ServerToClientEvents,
    SetVote,
    User
} from '../../spec/types'
import {generateAvatar} from './utils'
import {generateSeed} from './seed'
import * as config from './config'
import {RateLimiter} from "limiter";
import * as persistency from './persistency'
import * as parser from './parser'

type SocketData = {
    ok: true,
    id: string,
    user: string
    room: string
    avatar: string
} | { ok: false, id: string, room?: never, user?: never, avatar?: never }

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

io.on('connection', socket => {
    socket.data.id = socket.id

    console.log('socket', socket.data.id, 'on', 'connected')

    socket.on(ClientEvents.HEALTH, async (ack: Ack) => {
        try {
            console.log('socket', socket.data.id, 'on', ClientEvents.HEALTH)

            const server = true
            const data = await persistency.health()

            ack({ok: server && data})
        } catch (e) {
            handleUnexpected(e)
        }
    })

    socket.on(
        ClientEvents.JOIN_ROOM,
        async (input: JoinRoom, ack: Ack) => {
            try {
                console.log('socket', socket.data.id, 'on', ClientEvents.JOIN_ROOM, config.debug ? input : HIDDEN)
                const data = parser.joinRoom(input)

                // Limit
                await limit()

                // Assert room
                const exists = await persistency.hasRoom(data.room)
                if (!exists) await persistency.addRoom(data.room, data.seed ? generateSeed() : undefined)

                // Check if another user with same name exists
                const collision = await persistency.hasUser(data.room, data.user)
                if (collision) return emitError(`User ${data.user} already exists ...`, () => socket.disconnect(true))

                // New user
                const user: User = {
                    name: data.user,
                    avatar: generateAvatar(),
                }

                // Init metadata
                socket.data.ok = true
                socket.data.user = data.user
                socket.data.room = data.room
                socket.data.avatar = user.avatar

                // Update state
                await persistency.addUser(socket.data.room, user.name, user.avatar)
                await persistency.setHidden(socket.data.room, true)

                // Join broadcast
                socket.join(socket.data.room)

                // Fetch room
                const room = await persistency.getRoom(data.room)

                // Emit init state
                emitInitState(room)

                // Emit add user to room
                console.log('server', socket.data.room, 'emit', ServerEvents.ADD_USER, config.debug ? user : HIDDEN)
                socket.to(socket.data.room).emit(ServerEvents.ADD_USER, user)

                // Emit hide votes to room
                console.log('server', socket.data.room, 'emit', ServerEvents.HIDE_VOTES)
                socket.to(socket.data.room).emit(ServerEvents.HIDE_VOTES)

                // Emit ack
                ack({ok: true})
            } catch (e) {
                handleUnexpected(e)
            }
        }
    )

    socket.on(
        ClientEvents.SET_VOTE,
        async (input: SetVote) => {
            try {
                console.log('socket', socket.data.id, socket.data.room, 'on', ClientEvents.SET_VOTE, config.debug ? input : HIDDEN)
                const data = parser.setVote(input)

                // Limit
                await limit()

                // Assert socket
                if (!socket.data.ok) return socket.disconnect(true)

                // Assert room
                await persistency.hasRoom(socket.data.room)

                // Update state
                await persistency.setVote(socket.data.room, socket.data.user, data.vote)

                // Emit set vote to room
                const emit = {user: socket.data.user}
                console.log('server', socket.data.room, 'emit', ServerEvents.SET_VOTED, config.debug ? emit : HIDDEN)
                socket.to(socket.data.room).emit(ServerEvents.SET_VOTED, emit)
            } catch (e) {
                handleUnexpected(e)
            }
        }
    )

    socket.on(
        ClientEvents.SHOW_VOTES,
        async () => {
            try {
                console.log('socket', socket.data.id, socket.data.room, 'on', ClientEvents.SHOW_VOTES)

                // Limit
                await limit()

                // Assert
                if (!socket.data.ok) return socket.disconnect(true)

                // Assert room
                await persistency.hasRoom(socket.data.room)

                // Update state
                await persistency.setHidden(socket.data.room, false)

                // Fetch votes
                const data = await persistency.getVotes(socket.data.room)

                // Emit show votes to room
                console.log('server', socket.data.room, 'emit', ServerEvents.SHOW_VOTES, config.debug ? data : HIDDEN)
                socket.to(socket.data.room).emit(ServerEvents.SHOW_VOTES, data)
                socket.emit(ServerEvents.SHOW_VOTES, data)
            } catch (e) {
                handleUnexpected(e)
            }
        }
    )

    socket.on(
        ClientEvents.HIDE_VOTES,
        async () => {
            try {
                console.log('socket', socket.data.id, socket.data.room, 'on', ClientEvents.HIDE_VOTES)

                // Limit
                await limit()

                // Assert
                if (!socket.data.ok) return socket.disconnect(true)

                // Assert room
                await persistency.hasRoom(socket.data.room)

                // Update state
                await persistency.setHidden(socket.data.room, true)

                // Emit hide votes to room
                console.log('server', socket.data.room, 'emit', ServerEvents.HIDE_VOTES)
                socket.to(socket.data.room).emit(ServerEvents.HIDE_VOTES)
            } catch (e) {
                handleUnexpected(e)
            }
        }
    )

    socket.on(
        ClientEvents.CLOSE_ROOM,
        async (ack: Ack) => {
            try {
                console.log(socket.data.id, socket.data.room, 'on', ClientEvents.CLOSE_ROOM)

                // Limit
                await limit()

                // Assert
                if (!socket.data.ok) return socket.disconnect(true)

                // Emit ack
                ack({ok: true})

                // Close room
                await closeRoom()
            } catch (e) {
                handleUnexpected(e)
            }
        }
    )

    socket.on(ClientEvents.INIT_STATE, async () => {
        try {
            console.log('socket', socket.data.id, socket.data.room, 'on', ClientEvents.INIT_STATE)

            // Limit
            await limit()

            // Assert
            if (!socket.data.ok) return socket.disconnect(true)

            // Assert room
            await persistency.hasRoom(socket.data.room)

            // Get room
            const room = await persistency.getRoom(socket.data.room)

            // Emit init state
            emitInitState(room)
        } catch (e) {
            handleUnexpected(e)
        }

    })

    socket.on(
        'disconnect',
        async (reason) => {
            try {
                console.log('socket', socket.data.id, socket.data.room, 'on', 'disconnected', reason)

                // Assert
                if (!socket.data.ok) return socket.disconnect(true)

                if (socket.data.room) {
                    // Update state
                    await persistency.removeUser(socket.data.room, socket.data.user)
                    await persistency.removeVote(socket.data.room, socket.data.user)

                    // Remove socket from broadcast
                    socket.leave(socket.data.room)

                    // Emit remove user to room
                    const emit = {user: socket.data.user}
                    console.log(
                        'server',
                        socket.data.room,
                        'emit',
                        ServerEvents.REMOVE_USER,
                        config.debug ? emit : HIDDEN
                    )
                    socket.to(socket.data.room).emit(ServerEvents.REMOVE_USER, emit)
                }

                // Reset data
                socket.data = {
                    ok: false,
                    id: socket.data.id,
                }

            } catch (e) {
                handleUnexpected(e)
            }
        }
    )

    socket.on(
        'error',
        (error: Error) => {
            try {
                console.log(socket.data.id, socket.data.room, 'on', 'error', error)
            } catch (e) {
                handleUnexpected(e)
            }
        }
    )

    const limiter = new RateLimiter({tokensPerInterval: 30, interval: 60 * 500, fireImmediately: true})

    async function limit() {
        const remaining = await limiter.removeTokens(1)
        if (remaining > 0) return
        emitError('Too many requests ...')
    }

    function emitError(message: string, ack?: Ack): void {
        const emit = {message}
        console.log('server', socket.data.id, 'emit', ServerEvents.SHOW_NOTIFICATION, config.debug ? emit : HIDDEN)
        socket.emit(ServerEvents.SHOW_NOTIFICATION, emit, ack)
    }

    function handleUnexpected(error: unknown) {
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
            votes: room.hidden ? {} : room.votes,
            voted: room.voted
        }
        console.log('server', socket.data.id, 'emit', ServerEvents.INIT_STATE, config.debug ? init : HIDDEN)
        socket.emit(ServerEvents.INIT_STATE, init)
    }

    async function closeRoom() {
        // Assert
        if (!socket.data.ok) return socket.disconnect(true)

        // Update state
        await persistency.deleteRoom(socket.data.room)

        // Emit close room to room
        console.log('server', socket.data.room, 'emit', ServerEvents.CLOSE_ROOM)
        socket.to(socket.data.room).emit(ServerEvents.CLOSE_ROOM)

        // Disconnect all sockets by force
        const pool = io.sockets.adapter.rooms.get(socket.data.room) ?? new Set<string>()
        pool.forEach(id => {
            try {
                const other = io.sockets.sockets.get(id)
                if (other) other.disconnect(true)
            } catch (e) {
                handleUnexpected(e)
            }
        })
    }

})

io.listen(config.port)

process.on('unhandledRejection', err => {
    console.log(err)
})

process.on('SIGINT', async () => {
    try {
        console.log('server', 'on', 'SIGNIT')
        await io.close()
    } catch (e) {
        console.log(e)
        process.exit(1)
    }
})