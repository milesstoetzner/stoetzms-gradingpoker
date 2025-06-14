import Redis from "ioredis";
import {Room} from "../../spec/types";
import * as config from "./config";

// TODO: clean up stale rooms, e.g., no activity since 1 week.

// TODO: transaction?

const redis = new Redis({
    host: config.redis
})

export async function health() {
    try {
        await redis.ping()
        return true
    } catch (e) {
        console.log(e)
        return false
    }
}

export async function setHidden(room: string, hidden: boolean) {
    await redis.set(concatHiddenKey(room), String(hidden))
}

export async function hasUser(room: string, user: string) {
    return await redis.exists(concatUserKey(room, user)) > 0
}

export async function addUser(room: string, user: string, avatar: string) {
    await redis.set(concatUserKey(room, user), avatar)
}

export async function removeUser(room: string, user: string) {
    await redis.del(concatUserKey(room, user))
}

export async function setVote(room: string, user: string, vote: string) {
    const transaction = redis.multi()

    transaction.set(concatVotedKey(room, user), "true")
    transaction.set(concatVoteKey(room, user), vote)

    await transaction.exec()
}

export async function removeVote(room: string, user: string) {
    redis.del(concatVotedKey(room, user), concatVoteKey(room, user))
}

export async function hasRoom(room: string) {
    return await redis.exists(concatHiddenKey(room)) > 0
}

// TODO: seed
export async function addRoom(room: string, seed?: Room) {
    await setHidden(room, true)
}

export async function getRoom(room: string): Promise<Room> {
    const data: Room = {
        hidden: await redis.get(concatHiddenKey(room)) === "true",
        users: Object.entries(await collect(concatUserKey(room, any), String)).map(([name, avatar]) => ({
            name,
            avatar
        })),
        votes: await getVotes(room),
        voted: await collect(concatVotedKey(room, any), Boolean),
    }

    if (Object.keys(data.votes).length !== Object.keys(data.voted).length) {
        throw new Error(`Room ${room} is missing votes ...`)
    }

    if (Object.keys(data.users).length < Object.keys(data.voted).length) {
        throw new Error(`Room ${room} is missing users ...`)
    }

    return data
}

export async function getVotes(room: string) {
    return await collect(concatVoteKey(room, any), String)
}

async function collect<T>(pattern: string, transform: (it: string) => T): Promise<{ [key: string]: T }> {
    return new Promise((resolve, reject) => {
        const keys: string[] = []
        const stream = redis.scanStream({match: pattern})
        stream.on('data', (found) => keys.push(...found))
        stream.on('error', reject)
        stream.on("end", async () => {
            const result: { [keys: string]: T } = {}
            if (!keys.length) return resolve(result)
            const values = await redis.mget(keys)
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i]
                const value = values[i]
                if (!value) return reject(`Key ${key} has no value`)
                result[last(key)] = transform(value)
            }
            return resolve(result)
        })
    })
}

export async function deleteRoom(room: string) {
    return new Promise((resolve, reject) => {
        const collected: string[] = []
        const stream = redis.scanStream({match: concat("room", room, "*")})
        stream.on('data', (keys) => collected.push(...keys))
        stream.on('error', reject)
        stream.on("end", async () => {
            await redis.del(collected)
            return resolve(null)
        })
    })
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

function concatVotedKey(room: string, user: string) {
    return concat('room', room, 'voted', user)
}

function concatVoteKey(room: string, user: string) {
    return concat('room', room, 'vote', user)
}

function concatHiddenKey(room: string) {
    return concat('room', room, 'hidden')
}

const any = '*'
