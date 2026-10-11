import {randomUUID} from 'node:crypto'
import {Lock, Persistency, RoomData, RoomGone, Seed} from './types'
import {User, Votes} from '../../../spec/types'
import {Mutex, MutexInterface, withTimeout} from 'async-mutex'

type DataMemory = {
    [room: string]: {
        id: string
        version: number
        hidden: boolean
        users: User[]
        votes: Votes
    }
}

export class PersistencyMemory implements Persistency {
    private readonly mutexes: { [key: string]: MutexInterface } = {}

    private readonly data: DataMemory = {}

    async init() {
        // no-op
    }

    async close() {
        // no-op
    }

    async lock(room: string): Promise<Lock> {
        if (!this.mutexes[room]) this.mutexes[room] = withTimeout(new Mutex(), 2000)
        await this.mutexes[room].acquire()
        return this.mutexes[room]
    }

    async health() {
        return true
    }

    async setHidden(room: string, hidden: boolean) {
        this.data[room].hidden = hidden
    }

    async hasUser(room: string, user: string) {
        return this.data[room].users.some(u => u.name === user)
    }

    async addUser(room: string, user: string, avatar: string) {
        this.data[room].users.push({name: user, avatar})
    }

    async removeUser(room: string, user: string) {
        this.data[room].users = this.data[room].users.filter(u => u.name !== user)
    }

    async setVote(room: string, user: string, vote: string) {
        this.data[room].votes[user] = vote
    }

    async removeVote(room: string, user: string) {
        delete this.data[room].votes[user]
    }

    async hasRoom(room: string) {
        return !!this.data[room]
    }

    async assertRoom(room: string) {
        if (!(await this.hasRoom(room))) throw new RoomGone()
    }

    async addRoom(room: string, seed?: Seed) {
        this.data[room] = {
            id: randomUUID(),
            version: 0,
            hidden: seed?.hidden ?? true,
            users: seed?.users || [],
            votes: seed?.votes || {},
        }

    }

    async bump(room: string) {
        this.data[room].version++
    }

    async getRoom(room: string): Promise<RoomData> {
        const data = this.data[room]
        if (!data) throw new Error(`Room ${room} does not exist ...`)
        return {
            id: data.id,
            version: data.version,
            hidden: data.hidden,
            users: [...data.users],
            votes: {...data.votes},
        }
    }

    async deleteRoom(room: string) {
        delete this.data[room]
    }


}
