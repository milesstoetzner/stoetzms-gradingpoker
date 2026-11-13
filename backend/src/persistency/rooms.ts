import {randomUUID} from 'node:crypto'
import {User} from '../../../spec/types'
import {Connection, JoinResult, Member, Persistency, Room, RoomBusy, RoomData, RoomGone, Seed, Store} from './types'

// Attempts of an operation if other servers keep changing the room meanwhile. Operations users trigger by clicking
// (vote, show/hide) give up soon with RoomBusy and the user clicks again. Joins (also automatic on reconnect), leaving
// and housekeeping (e.g., disconnects) keep starting over, since nobody clicks again for them.
const ATTEMPTS = {click: 3, automatic: 50}

/**
 * The rules of a room, independent of where rooms are stored.
 *
 * Every operation reads the room, applies its changes to a copy and writes the copy only if nobody changed the room
 * meanwhile (optimistic concurrency, see Store.write). Otherwise, it starts over with the latest room, but only a
 * limited number of times (see ATTEMPTS). Within one server, operations on the same room are queued, so that only
 * operations of different servers can conflict.
 */
export class Rooms implements Persistency {
    private readonly queues = new Map<string, Promise<unknown>>()

    constructor(
        private readonly store: Store,
        // Seconds an offline user keeps their seat
        private readonly grace: number
    ) {}

    async init() {
        await this.store.init()
    }

    async close() {
        await this.store.close()
    }

    async health() {
        return this.store.health()
    }

    async join(name: string, user: Omit<User, 'online'>, connection: Connection, seed?: Seed): Promise<JoinResult> {
        const {room, result} = await this.update(
            name,
            room => {
                // Take over the existing user (e.g., reconnect) which keeps their vote
                const existing = find(room, user.name)
                if (existing) {
                    if (existing.session !== connection.session) return 'collision'

                    existing.socket = connection.socket
                    delete existing.offline
                    return 'takeover'
                }

                room.users.push({name: user.name, avatar: user.avatar, ...connection})
                room.hidden = true
            },
            {create: () => create(seed), attempts: ATTEMPTS.automatic}
        )
        if (result === 'collision') return {ok: false, reason: 'collision'}
        return {ok: true, room, takeover: result === 'takeover'}
    }

    async leave(name: string, user: string) {
        const {room} = await this.update(name, room => remove(room, user), {attempts: ATTEMPTS.automatic})
        return room
    }

    async disconnect(name: string, user: string, socket: string, mode: 'leave' | 'offline') {
        try {
            const {room} = await this.update(
                name,
                room => {
                    const existing = find(room, user)
                    if (existing?.socket !== socket) return

                    if (mode === 'leave') remove(room, user)
                    else existing.offline = now()
                },
                {attempts: ATTEMPTS.automatic}
            )
            return room
        } catch (e) {
            if (e instanceof RoomGone) return
            throw e
        }
    }

    async prune(name: string) {
        try {
            // Every update removes expired offline users
            const {room, changed} = await this.update(name, () => {}, {attempts: ATTEMPTS.automatic})
            if (changed) return room
        } catch (e) {
            if (e instanceof RoomGone) return
            throw e
        }
    }

    async vote(name: string, user: string, vote: string) {
        const {room} = await this.update(name, room => {
            if (!find(room, user)) throw new RoomGone()

            room.votes[user] = vote
            room.hidden = true
        })
        return room
    }

    async setHidden(name: string, hidden: boolean) {
        const {room} = await this.update(name, room => {
            room.hidden = hidden
        })
        return room
    }

    async getRoom(name: string) {
        const room = await this.store.get(name)
        if (!room) throw new RoomGone()
        return toData(room)
    }

    async deleteRoom(name: string) {
        await this.store.delete(name)
    }

    /**
     * Removes expired offline users and applies the change to a copy of the latest room, then writes it, if something
     * changed. Creates the room if it does not exist and create is given, otherwise throws RoomGone.
     *
     * Starts over with the latest room if another server changed the room meanwhile, up to the given attempts, then
     * throws RoomBusy. Hence, the change might be applied several times and must not have side effects.
     */
    private update<T>(
        name: string,
        change: (room: Room) => T,
        {create, attempts = ATTEMPTS.click}: {create?: () => Room; attempts?: number} = {}
    ) {
        return this.queued(name, async () => {
            for (let attempt = 0; attempt < attempts; attempt++) {
                const current = await this.store.get(name)
                const room = structuredClone(current) ?? create?.()
                if (!room) throw new RoomGone()

                this.removeExpired(room)
                const result = change(room)
                if (current && JSON.stringify(room) === JSON.stringify(current)) {
                    return {room: toData(current), result, changed: false}
                }

                room.version++
                if (await this.store.write(name, room, current)) return {room: toData(room), result, changed: true}
            }
            throw new RoomBusy()
        })
    }

    private removeExpired(room: Room) {
        for (const user of room.users) {
            if (user.offline !== undefined && now() - user.offline >= this.grace) remove(room, user.name)
        }
    }

    // Runs the tasks of a room one after another
    private queued<T>(name: string, task: () => Promise<T>): Promise<T> {
        const result = (this.queues.get(name) ?? Promise.resolve()).then(task)
        const done = result.catch(() => {})
        this.queues.set(name, done)
        done.then(() => {
            if (this.queues.get(name) === done) this.queues.delete(name)
        })
        return result
    }
}

function create(seed?: Seed): Room {
    return {
        id: randomUUID(),
        version: 0,
        hidden: seed?.hidden ?? true,
        users: seed?.users.map(it => ({name: it.name, avatar: it.avatar, session: '', socket: ''})) ?? [],
        votes: {...seed?.votes},
    }
}

function find(room: Room, user: string): Member | undefined {
    return room.users.find(it => it.name === user)
}

function remove(room: Room, user: string) {
    room.users = room.users.filter(it => it.name !== user)
    delete room.votes[user]
}

function toData(room: Room): RoomData {
    return {
        id: room.id,
        version: room.version,
        hidden: room.hidden,
        users: room.users.map(it => ({name: it.name, avatar: it.avatar, online: it.offline === undefined})),
        votes: {...room.votes},
    }
}

function now() {
    return Math.floor(Date.now() / 1000)
}
