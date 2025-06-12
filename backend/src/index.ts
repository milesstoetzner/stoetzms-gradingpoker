import {Server} from 'socket.io'
import {Ack, ClientEvents, HIDDEN, InitState, JoinRoom, ServerEvents, SetVote, User} from '../../spec/types'
import {generateAvatar, haeParameter, haeVoid} from './utils'
import {generateSeed} from './seed'
import * as config from './config'

// TODO: clean up stale rooms, e.g., no activity since 1 week

// TODO: dont log private or huge data

// TODO: gracefully stop

// TODO: rate limiter

const store: {[room: string]: InitState} = {}

const io = new Server({
    path: '/socket.io',
    cors: {
        // TODO: restrict this
        origin: '*',
    },
    pingInterval: 2000,
    pingTimeout: 2000,
})

io.on('error', (err: Error) => {
    console.log('server', 'on', 'error', err)
})

io.on('connection', socket => {
    socket.data.id = socket.id

    console.log(socket.data.id, 'on', 'connected')

    socket.on(
        ClientEvents.JOIN_ROOM,
        haeParameter((data: JoinRoom) => {
            console.log(socket.id, ClientEvents.JOIN_ROOM, 'on', config.debug ? data : HIDDEN)

            // Init room
            if (!store[data.room]) {
                store[data.room] = {hidden: true, users: [], votes: {}}
            }

            // Room
            const room = store[data.room]

            // Seed
            if (data.seed) {
                const seed = generateSeed()
                room.users = seed.users
                room.votes = seed.votes
            }

            // Check if another user with same name exists
            const found = room.users.find(it => it.name === data.user)
            if (found) {
                emitError(`User ${data.user} already exists ...`)
                return socket.disconnect(true)
            }

            // Init metadata
            socket.data.user = data.user
            socket.data.room = data.room

            // Add user to room
            const user: User = {
                name: socket.data.user,
                avatar: generateAvatar(),
            }
            room.users.push(user)
            room.hidden = true

            socket.join(data.room)

            // Emit init state
            console.log('server', socket.data.id, 'emit', ServerEvents.INIT_STATE, config.debug ? room : HIDDEN)
            socket.emit(ServerEvents.INIT_STATE, room)

            // Emit add user to room
            console.log('server', socket.data.room, 'emit', ServerEvents.ADD_USER, config.debug ? user : HIDDEN)
            socket.to(socket.data.room).emit(ServerEvents.ADD_USER, user)

            // Emit hide votes to room
            console.log('server', socket.data.room, 'emit', ServerEvents.HIDE_VOTES)
            socket.to(socket.data.room).emit(ServerEvents.HIDE_VOTES)
        })
    )

    socket.on(
        ClientEvents.SET_VOTE,
        haeParameter((data: Omit<SetVote, 'user'>) => {
            console.log(socket.data.id, socket.data.room, 'on', ClientEvents.SET_VOTE)

            // Update state
            const room = store[socket.data.room]
            if (!room) return emitError(`Room ${socket.data.room} not found ...`)
            room.votes[socket.data.user] = data.vote

            // Emit set vote to room
            const emit = {user: socket.data.user, vote: data.vote}
            console.log('server', socket.data.room, 'emit', ServerEvents.SET_VOTE, config.debug ? emit : HIDDEN)
            socket.to(socket.data.room).emit(ServerEvents.SET_VOTE, emit)
        })
    )

    socket.on(
        ClientEvents.SHOW_VOTES,
        haeVoid(() => {
            console.log(socket.data.id, socket.data.room, 'on', ClientEvents.SHOW_VOTES)

            // Update state
            const room = store[socket.data.room]
            if (!room) return emitError(`Room ${socket.data.room} not found ...`)
            room.hidden = false

            // Emit hide votes to room
            console.log('server', socket.data.room, 'emit', ServerEvents.HIDE_VOTES)
            socket.to(socket.data.room).emit(ServerEvents.SHOW_VOTES)
        })
    )

    socket.on(
        ClientEvents.HIDE_VOTES,
        haeVoid(() => {
            console.log(socket.data.id, socket.data.room, 'on', ClientEvents.HIDE_VOTES)

            // Update state
            const room = store[socket.data.room]
            if (!room) return emitError(`Room ${socket.data.room} not found ...`)
            room.hidden = true

            // Emit hide votes to room
            console.log('server', socket.data.room, 'emit', ServerEvents.HIDE_VOTES)
            socket.to(socket.data.room).emit(ServerEvents.HIDE_VOTES)
        })
    )

    socket.on(
        ClientEvents.CLOSE_ROOM,
        haeParameter((ack: Ack) => {
            console.log(socket.data.id, socket.data.room, 'on', ClientEvents.CLOSE_ROOM)
            ack()
            closeRoom()
        })
    )

    socket.on(
        'disconnect',
        haeParameter(reason => {
            console.log(socket.data.id, socket.data.room, 'on', 'disconnected', reason)

            if (socket.data.room) {
                // Update state
                const room = store[socket.data.room]
                if (!room) return
                room.users = room.users.filter(it => it.name !== socket.data.user)

                // Remove socket from room
                socket.leave(socket.data.room)

                if (!room.users.length) {
                    // Close room
                    closeRoom()
                } else {
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
            }
        })
    )

    socket.on(
        'error',
        haeParameter((error: Error) => {
            console.log(socket.data.id, socket.data.room, 'on', 'error', error)
        })
    )

    function emitError(message: string) {
        const emit = {message}
        console.log('server', socket.data.id, 'emit', ServerEvents.SHOW_NOTIFICATION, config.debug ? emit : HIDDEN)
        socket.emit(ServerEvents.SHOW_NOTIFICATION, emit)
    }

    function closeRoom() {
        // Update state
        delete store[socket.data.room]

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
                console.log(e)
            }
        })
    }
})

io.listen(3000)
