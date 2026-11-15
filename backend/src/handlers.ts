import {Ack, ClientEvents} from '../../spec/types'
import {Broadcast} from './broadcast'
import {Client} from './client'
import * as config from './config'
import * as parser from './parser'
import {generateSeed} from './seed'
import {Rooms} from './store/rooms'
import {Me} from './types'

export type Context = {
    rooms: Rooms
    broadcast: Broadcast
    // Disconnect handlers still running, awaited on shutdown so that users are marked offline before exiting
    disconnecting: Set<Promise<void>>
}

/**
 * Registers what a client can do: join a room, vote, comment, show and hide the votes, remove users and close the
 * room. Leaving is disconnecting.
 */
export function registerHandlers(client: Client, context: Context) {
    const {rooms, disconnecting} = context
    const {socket} = client

    socket.on(ClientEvents.HEALTH, async (ack: Ack) => {
        try {
            parser.ack(ack)
            ack({ok: await rooms.health()})
        } catch (e) {
            client.handleError(e)
        }
    })

    client.on(ClientEvents.JOIN_ROOM, input => join(client, context, input))

    client.onJoined(ClientEvents.SET_VOTE, async (input, me) => {
        const {vote} = parser.setVote(input)

        // Fails if the room is closed or the user has been removed
        await rooms.vote(me.room, me.user, vote)
    })

    client.onJoined(ClientEvents.SET_COMMENT, async (input, me) => {
        const {comment} = parser.setComment(input)

        // Comments are only editable while votes are hidden. Nobody else is told: that would reveal who commented
        if ((await rooms.comment(me.room, me.user, comment)) === 'shown') {
            client.emitError('Comments can only be changed while votes are hidden ...')
            return false
        }
    })

    client.onJoined(ClientEvents.SHOW_VOTES, async (_, me) => {
        await rooms.setHidden(me.room, false, me.user)
    })

    client.onJoined(ClientEvents.HIDE_VOTES, async (_, me) => {
        await rooms.setHidden(me.room, true, me.user)
    })

    client.onJoined(ClientEvents.INIT_STATE, async (_, me) => {
        await client.emitOwnState(me)
    })

    client.onJoined(ClientEvents.REMOVE_USER, async (input, me) => {
        const {user} = parser.removeUser(input)

        // The servers disconnect the sockets of the removed user
        await rooms.leave(me.room, user, me.user)
    })

    client.onJoined(ClientEvents.CLOSE_ROOM, async (_, me) => {
        // The servers tell and disconnect everyone in the room (including this client)
        await rooms.deleteRoom(me.room)

        return false
    })

    socket.on('disconnect', reason => {
        const pending = disconnect(client, context, reason).finally(() => disconnecting.delete(pending))
        disconnecting.add(pending)
    })

    socket.on('error', (error: Error) => {
        client.log('on', 'error', error)
    })
}

async function join(client: Client, {rooms, broadcast}: Context, input: unknown) {
    const {socket} = client
    const {room, user, session, seed} = parser.joinRoom(input)

    if (socket.data.ok) {
        client.emitError('Already joined a room ...')
        return false
    }
    const me: Me = {room, user}

    await broadcast.enter(room, socket.id)
    let result
    try {
        result = await rooms.join(
            room,
            user,
            {session, socket: socket.id},
            seed && config.seed ? generateSeed() : undefined
        )
    } catch (e) {
        await broadcast.exit(room, socket.id)
        throw e
    }

    // Another user with the same name exists
    if (result === 'collision') {
        await broadcast.exit(room, socket.id)
        client.emitError(`User ${user} already exists ...`, () => socket.disconnect(true))
        return false
    }

    // The socket is gone meanwhile, its disconnect handler did not know about the room yet
    if (!socket.connected) {
        await rooms.disconnect(room, user, socket.id, 'offline')
        await broadcast.exit(room, socket.id)
        return false
    }

    socket.data = {ok: true, id: socket.id, user, room, session}

    // Receive the events of the room
    socket.join(room)

    await client.emitOwnState(me)
}

async function disconnect(client: Client, {rooms, broadcast}: Context, reason: string) {
    const {socket} = client
    try {
        client.log('on', 'disconnected', reason)

        if (!socket.data.ok) return
        const me: Me = {room: socket.data.room, user: socket.data.user}
        socket.data = {ok: false, id: socket.id}

        // Leaving on purpose (leave button, closing the room) removes the user. Otherwise (network, server restart),
        // the user stays offline with their vote and might reconnect within the grace period.
        const mode = reason === 'client namespace disconnect' ? 'leave' : 'offline'

        // No-op if the user has been taken over by another socket meanwhile. Offline users are removed by the
        // heartbeat once their grace period ended
        await rooms.disconnect(me.room, me.user, socket.id, mode)
        await broadcast.exit(me.room, socket.id)
    } catch (e) {
        client.handleError(e)
    }
}
