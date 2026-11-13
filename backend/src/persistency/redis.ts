import Redis from 'ioredis'
import * as config from '../config'
import {revision, Room, Store} from './types'

/**
 * Stores the room only if the stored revision is still the expected one (empty if no room is stored) and resets its
 * expiry. Redis executes scripts atomically, hence, this compare and set is atomic across all servers.
 *
 * KEYS: room
 * ARGV: expected revision, new revision, room (json), ttl (seconds)
 */
const WRITE = `
local current = redis.call('HGET', KEYS[1], 'revision') or ''
if current ~= ARGV[1] then return 0 end

redis.call('HSET', KEYS[1], 'revision', ARGV[2], 'room', ARGV[3])
redis.call('EXPIRE', KEYS[1], ARGV[4])
return 1
`

/**
 * Keeps every room as hash room:{name} with the fields room (json) and revision (see revision()), so that multiple
 * servers can share the rooms. Rooms without changes for the TTL expire, i.e., are deleted by Redis itself.
 */
export class RedisStore implements Store {
    private _redis?: Redis

    // ttl: seconds after the last change until a room is deleted
    constructor(private readonly ttl: number) {}

    get redis() {
        if (!this._redis) throw new Error('Redis not initialized')
        return this._redis
    }

    async init() {
        this._redis = new Redis({
            host: config.redis,
            port: config.redisPort,
        })
        this._redis.defineCommand('gradingpokerWrite', {numberOfKeys: 1, lua: WRITE})
    }

    async close() {
        await this._redis?.quit()
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

    async get(name: string) {
        const room = await this.redis.hget(key(name), 'room')
        if (!room) return
        return JSON.parse(room) as Room
    }

    async write(name: string, room: Room, expected: Room | undefined) {
        const written = await (this.redis as any).gradingpokerWrite(
            key(name),
            revision(expected),
            revision(room),
            JSON.stringify(room),
            this.ttl
        )
        return written === 1
    }

    async delete(name: string) {
        await this.redis.del(key(name))
    }
}

function key(name: string) {
    return `room:${name}`
}
