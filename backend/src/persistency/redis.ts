import {randomUUID} from 'node:crypto'
import Redis from 'ioredis'
import {Votes} from '../../../spec/types'
import * as config from "../config";
import {Mutex, MutexInterface, withTimeout} from 'async-mutex'
import {Lock, Persistency, RoomData, RoomGone, Seed} from './types'


export class PersistencyRedis implements Persistency {
    private readonly mutexes: { [key: string]: MutexInterface } = {}
    private _redis?: Redis

    get redis() {
        if (!this._redis) throw new Error("Redis not initialized")
        return this._redis
    }

    async init() {
        this._redis = new Redis({
            host: config.redis,
            port: config.redisPort,
        })
    }

    async close() {
        await this._redis?.quit()
    }

    async lock(room: string): Promise<Lock> {
        if (!this.mutexes[room]) this.mutexes[room] = withTimeout(new Mutex(), 2000)
        await this.mutexes[room].acquire()
        return this.mutexes[room]
    }

    async health() {
        try {
            await this.redis.ping()
            return true
        } catch (e) {
            console.log(e)
            return false
        }
    }

    async setHidden(room: string, hidden: boolean) {
        await this.redis.set(concatHiddenKey(room), String(hidden))
    }

    async hasUser(room: string, user: string) {
        return await this.exists(concatUserKey(room, user))
    }

    async addUser(room: string, user: string, avatar: string) {
        await this.redis.set(concatUserKey(room, user), avatar)
    }

    async removeUser(room: string, user: string) {
        await this.redis.del(concatUserKey(room, user))
    }

    async setVote(room: string, user: string, vote: string) {
        await this.redis.set(concatVoteKey(room, user), vote)
    }

    async removeVote(room: string, user: string) {
        await this.redis.del(concatVoteKey(room, user))
    }

    async hasRoom(room: string) {
        return this.exists(concatHiddenKey(room))
    }

    async assertRoom(room: string) {
        if (!(await this.hasRoom(room))) throw new RoomGone()
    }

    async addRoom(room: string, seed?: Seed) {
        await this.redis.set(concat('room', room, 'id'), randomUUID())
        await this.redis.set(concat('room', room, 'version'), 0)
        await this.setHidden(room, true)

        if (seed) {
            await this.setHidden(room, seed.hidden)

            for (const user of seed.users) {
                await this.addUser(room, user.name, user.avatar)
            }

            for (const [user, vote] of Object.entries(seed.votes)) {
                await this.setVote(room, user, vote)
            }
        }
    }

    async bump(room: string) {
        await this.redis.incr(concat('room', room, 'version'))
    }

    async getRoom(room: string): Promise<RoomData> {
        return {
            id: (await this.redis.get(concat('room', room, 'id'))) ?? '',
            version: Number(await this.redis.get(concat('room', room, 'version'))),
            hidden: (await this.redis.get(concatHiddenKey(room))) === 'true',
            users: Object.entries(await this.collect(concatUserKey(room, any))).map(([name, avatar]) => ({
                name,
                avatar,
            })),
            votes: await this.getVotes(room),
        }
    }

    async getVotes(room: string): Promise<Votes> {
        return await this.collect(concatVoteKey(room, any))
    }


    async deleteRoom(room: string) {
        await new Promise((resolve, reject) => {
            const collected: string[] = []
            const stream = this.redis.scanStream({match: concat("room", room, "*")})
            stream.on('data', (keys) => collected.push(...keys))
            stream.on('error', reject)
            stream.on("end", async () => {
                await this.redis.del(collected)
                return resolve(null)
            })
        })
    }


    private async collect(pattern: string): Promise<{ [key: string]: string }> {
        return new Promise((resolve, reject) => {
            const keys: string[] = []
            const stream = this.redis.scanStream({match: pattern})
            stream.on('data', (found) => keys.push(...found))
            stream.on('error', reject)
            stream.on("end", async () => {
                const result: { [keys: string]: string } = {}
                if (!keys.length) return resolve(result)
                const values = await this.redis.mget(keys)
                for (let i = 0; i < keys.length; i++) {
                    const key = keys[i]
                    const value = values[i]
                    if (!value) return reject(`Key ${key} has no value`)
                    result[last(key)] = value
                }
                return resolve(result)
            })
        })
    }

    private async exists(key: string): Promise<boolean> {
        return (await this.redis.exists(key)) > 0
    }
}

function last(key: string) {
    const split = key.split(":")
    return split[split.length - 1]!
}

function concat(...data: string[]) {
    return data.join(':')
}

function concatUserKey(room: string, user: string) {
    return concat('room', room, 'user', user)
}

function concatVoteKey(room: string, user: string) {
    return concat('room', room, 'vote', user)
}

function concatHiddenKey(room: string) {
    return concat('room', room, 'hidden')
}

const any = '*'
