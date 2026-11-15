import {randomUUID} from 'node:crypto'
import {Cluster} from 'ioredis'
import {connect, Connection as Redis} from '../redis'
import * as scripts from './scripts'
import {Connection, JoinResult, RoomData, RoomGone, Seed, StoreEvent} from './types'

const COMMANDS = {
    roomJoin: scripts.JOIN,
    roomLeave: scripts.LEAVE,
    roomDisconnect: scripts.DISCONNECT,
    roomVote: scripts.VOTE,
    roomComment: scripts.COMMENT,
    roomSetHidden: scripts.SET_HIDDEN,
    roomClose: scripts.CLOSE,
    roomSync: scripts.SYNC,
    roomSnapshot: scripts.SNAPSHOT,
}

/**
 * Operations on rooms, stored in Redis. Every operation is one script (see scripts.ts), i.e., atomic also across
 * multiple servers, never waits for another operation and costs the same for small and large rooms.
 *
 * Operations on rooms which do not exist (anymore) throw RoomGone instead of recreating them (housekeeping
 * operations like disconnect and sync return undefined instead).
 *
 * Changes are published as events (see StoreEvent). A server subscribes to the rooms it has sockets in.
 */
export class Rooms {
    private redis!: Redis
    private subscriber!: Redis
    private listener?: (room: string, event: StoreEvent) => void
    private restored?: () => void

    constructor(
        // Seconds after the last change until a room is deleted
        private readonly ttl: number,
        // Seconds an offline user keeps their seat
        private readonly grace: number
    ) {}

    async init() {
        this.redis = connect()
        for (const [name, lua] of Object.entries(COMMANDS)) this.redis.defineCommand(name, {numberOfKeys: 5, lua})

        // A subscribing connection cannot send other commands
        this.subscriber = connect()
        this.subscriber.on('smessage', (channel: string, message: string) => {
            try {
                this.listener?.(fromChannel(channel), JSON.parse(message))
            } catch (e) {
                console.log(e)
            }
        })

        // Events published while the subscriber was disconnected are lost
        let ready = false
        this.subscriber.on('ready', () => {
            if (ready) this.restored?.()
            ready = true
        })
    }

    async close() {
        await Promise.allSettled([this.redis?.quit(), this.subscriber?.quit()])
    }

    // Whether rooms can be read and written. A Redis Cluster answers pings even while it is down as a whole (e.g., a
    // part of the rooms has no node), hence, its own state is checked as well.
    async health() {
        try {
            await this.redis.ping()
            if (this.redis instanceof Cluster) return /^cluster_state:ok/m.test(await this.redis.cluster('INFO'))
            return true
        } catch (e) {
            console.log(e)
            return false
        }
    }

    // Called for every event of a subscribed room
    onEvent(listener: (room: string, event: StoreEvent) => void) {
        this.listener = listener
    }

    // Called when events of subscribed rooms might have been missed
    onRestored(listener: () => void) {
        this.restored = listener
    }

    async subscribe(room: string) {
        await this.subscriber.ssubscribe(keys(room)[4])
    }

    async unsubscribe(room: string) {
        await this.subscriber.sunsubscribe(keys(room)[4])
    }

    // Creates the room if required, adds the user and hides votes, or takes over the user if the session matches
    async join(room: string, user: string, connection: Connection, seed?: Seed): Promise<JoinResult> {
        return this.run('roomJoin', room, user, connection.session, connection.socket, randomUUID(), seed ? JSON.stringify(seed) : '')
    }

    // Removes the user, their vote and their comment (by: who removed them, if not themselves)
    async leave(room: string, user: string, by?: string) {
        this.assert(await this.run('roomLeave', room, user, by ?? ''))
    }

    // Removes the user (leave) or marks them as offline, but only if the socket is still the user's current one
    async disconnect(room: string, user: string, socket: string, mode: 'leave' | 'offline') {
        await this.run('roomDisconnect', room, user, socket, mode, now())
    }

    // Sets the vote of the user (who must be in the room) and hides votes
    async vote(room: string, user: string, vote: string) {
        this.assert(await this.run('roomVote', room, user, vote))
    }

    // Sets (or removes, if empty) the comment of the user (who must be in the room); only while votes are hidden
    async comment(room: string, user: string, comment: string): Promise<'ok' | 'shown'> {
        return this.assert(await this.run('roomComment', room, user, comment))
    }

    async setHidden(room: string, hidden: boolean) {
        this.assert(await this.run('roomSetHidden', room, hidden ? '1' : '0'))
    }

    async deleteRoom(room: string) {
        await this.run('roomClose', room)
    }

    // Removes offline users whose grace period ended and returns the current version, or undefined if the room is gone
    async sync(room: string): Promise<{id: string; version: number} | undefined> {
        const result = await this.run('roomSync', room, now(), this.grace)
        if (!result) return
        return {id: result[0], version: Number(result[1])}
    }

    async getRoom(room: string): Promise<RoomData> {
        const result = await this.run('roomSnapshot', room)
        if (!result) throw new RoomGone()

        const [meta, users, votes, comments] = (result as string[][]).map(toObject)
        return {
            id: meta.id,
            version: Number(meta.version),
            hidden: meta.hidden === '1',
            users: Object.entries(users)
                .map(([name, raw]) => ({name, ...(JSON.parse(raw) as {seq: number; offline?: number})}))
                .sort((a, b) => a.seq - b.seq)
                .map(it => ({name: it.name, online: it.offline === undefined})),
            votes,
            comments,
        }
    }

    private run(command: keyof typeof COMMANDS, room: string, ...args: (string | number)[]): Promise<any> {
        return (this.redis as any)[command](...keys(room), this.ttl, ...args)
    }

    private assert<T extends string>(result: T | 'gone'): T {
        if (result === 'gone') throw new RoomGone()
        return result as T
    }
}

// The hash tag {name} keeps all keys of a room in one slot of a Redis Cluster, as required by the scripts
function keys(room: string) {
    const base = `room:{${room}}`
    return [base, `${base}:users`, `${base}:votes`, `${base}:comments`, `${base}:events`]
}

function fromChannel(channel: string) {
    return channel.slice('room:{'.length, -'}:events'.length)
}

function toObject(flat: string[]) {
    const object: {[key: string]: string} = {}
    for (let i = 0; i < flat.length; i += 2) object[flat[i]] = flat[i + 1]
    return object
}

function now() {
    return Math.floor(Date.now() / 1000)
}
