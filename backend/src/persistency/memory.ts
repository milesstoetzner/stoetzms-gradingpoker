import {Lock, Persistency} from "./types";
import {Room, User, Votes} from "../../../spec/types";
import {Mutex, MutexInterface, withTimeout} from 'async-mutex'

type DataMemory = {
    [room: string]: {
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

    async addRoom(room: string, seed?: Room) {
        this.data[room] = {
            hidden: true,
            users: seed?.users || [],
            votes: seed?.votes || {},
        }

    }

    async getRoom(room: string): Promise<Room> {
        const data = this.data[room]
        return {
            hidden: data.hidden,
            users: data.users,
            votes: data.votes,
            voted: Object.fromEntries(Object.keys(data.votes).map(user => [user, true]))
        }
    }

    async getVotes(room: string) {
        return (await this.getRoom(room)).votes
    }

    async deleteRoom(room: string) {
        delete this.data[room]
    }


}
