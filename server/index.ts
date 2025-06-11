import {Server} from "socket.io";
import {ClientEvents, InitState, JoinRoom, ServerEvents, SetVote, User} from "~/socket/types";
import {DummyUsers, DummyVotes} from "./dummy";
import {generateAvatar} from "./utils";

// TODO: clean up stale rooms, e.g., no activity since 1 week

// TODO: return errors to user

// TODO: dont log private or huge data

// TODO: error handling in general

const store: {
    [room: string]: InitState
} = {}

const io = new Server({
    cors: {
        origin: "*",
    }
});

io.on("connection", (socket) => {
    // ...
    socket.data.id = socket.id

    console.log(socket.data.id, 'connected');

    socket.on(ClientEvents.JOIN_ROOM, (data: JoinRoom) => {
        console.log(socket.id, ClientEvents.JOIN_ROOM, 'on', data);

        // Init metadata
        socket.data.user = data.user
        socket.data.room = data.room

        // Init room
        if (!store[data.room]) {
            // TODO: drop dummies
            store[data.room] = {
                hidden: true,
                users: DummyUsers(),
                votes: DummyVotes()
            }
        }
        const room = store[data.room]

        // Check if another user with same name exists
        const found = room.users.find(it => it.name === socket.data.user)
        if (found) throw new Error(`User ${socket.data.user} already exists`)

        // Add user to room
        const user: User = {
            name: socket.data.user,
            avatar: generateAvatar()
        }
        room.users.push(user)
        room.hidden = true;

        socket.join(data.room)

        // Emit init state
        console.log('server', socket.data.id, 'emit', ServerEvents.INIT_STATE, room);
        socket.emit(ServerEvents.INIT_STATE, room);

        // Emit add user to room
        console.log('server', socket.data.room, 'emit', ServerEvents.ADD_USER, user);
        socket.to(socket.data.room).emit(ServerEvents.ADD_USER, user)

        // Emit hide votes to room
        console.log('server', socket.data.room, 'emit', ServerEvents.HIDE_VOTES);
        socket.to(socket.data.room).emit(ServerEvents.HIDE_VOTES);
    })

    socket.on(ClientEvents.SET_VOTE, (data: Omit<SetVote, 'user'>) => {
        console.log(socket.data.id, socket.data.room, 'on', ClientEvents.SET_VOTE);

        // Update state
        const room = store[socket.data.room]
        if (!room) throw new Error("Room not found");
        room.votes[socket.data.user] = data.vote;

        // Emit set vote to room
        const emit = {user: socket.data.user, vote: data.vote}
        console.log('server', socket.data.room, 'emit', ServerEvents.SET_VOTE, emit);
        socket.to(socket.data.room).emit(ServerEvents.SET_VOTE, emit);
    })

    socket.on(ClientEvents.SHOW_VOTES, () => {
        console.log(socket.data.id, socket.data.room, 'on', ClientEvents.SHOW_VOTES);

        // Update state
        const room = store[socket.data.room]
        if (!room) throw new Error("Room not found");
        room.hidden = false;

        // Emit hide votes to room
        console.log('server', socket.data.room, 'emit', ServerEvents.HIDE_VOTES);
        socket.to(socket.data.room).emit(ServerEvents.SHOW_VOTES);
    })


    socket.on(ClientEvents.HIDE_VOTES, () => {
        console.log(socket.data.id, socket.data.room, 'on', ClientEvents.HIDE_VOTES);

        // Update state
        const room = store[socket.data.room]
        if (!room) throw new Error("Room not found");
        room.hidden = true;

        // Emit hide votes to room
        console.log('server', socket.data.room, 'emit', ServerEvents.HIDE_VOTES);
        socket.to(socket.data.room).emit(ServerEvents.HIDE_VOTES);
    })

    socket.on(ClientEvents.CLOSE_ROOM, () => {
        console.log(socket.data.id, socket.data.room, 'on', ClientEvents.CLOSE_ROOM);
        closeRoom()
    })

    socket.on('disconnect', () => {
        console.log(socket.data.id, socket.data.room, 'on', 'disconnected');

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
                console.log('server', socket.data.room, 'emit', ServerEvents.REMOVE_USER, emit);
                socket.to(socket.data.room).emit(ServerEvents.REMOVE_USER, emit)
            }
        }

    })

    function closeRoom() {
        // Update state
        delete store[socket.data.room]

        // Emit close room to room
        console.log('server', socket.data.room, 'emit', ServerEvents.CLOSE_ROOM);
        socket.to(socket.data.room).emit(ServerEvents.CLOSE_ROOM);

        // Disconnect all sockets by force
        const pool = io.sockets.adapter.rooms.get(socket.data.room) ?? new Set<string>()
        pool.forEach((id) => {
            try {
                const other = io.sockets.sockets.get(id);
                if (other) other.disconnect(true)
            } catch (e) {
                console.log(e)
            }
        })

    }

});

io.listen(3000);
