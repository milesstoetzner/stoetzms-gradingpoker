import Redis from "ioredis";
import {Room, Votes} from "../../spec/types";
import * as config from "./config";
import {Mutex, MutexInterface, withTimeout} from 'async-mutex'

const redis = new Redis({
    host: config.redis
})

const mutexes: {[key: string]: MutexInterface} = {}

export async function lock(room: string): Promise<Lock> {
    if (!mutexes[room]) mutexes[room] = withTimeout(new Mutex(), 2000)
    await mutexes[room].acquire()
    return mutexes[room]
}

export type Lock = {
    release(): void
}

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
    return await exists(concatUserKey(room, user))
}

export async function addUser(room: string, user: string, avatar: string) {
    await redis.set(concatUserKey(room, user), avatar)
}

export async function removeUser(room: string, user: string) {
    await redis.del(concatUserKey(room, user))
}

export async function setVote(room: string, user: string, vote: string) {
    await redis.set(concatVoteKey(room, user), vote)
}

export async function removeVote(room: string, user: string) {
    await redis.del(concatVoteKey(room, user))
}

export async function hasRoom(room: string) {
    return exists(concatHiddenKey(room))
}


// TODO: seed
export async function addRoom(room: string, seed?: Room) {
    await setHidden(room, true)
}

export async function getRoom(room: string): Promise<Room> {
    const votes = await getVotes(room)

    const data: Room = {
        hidden: await redis.get(concatHiddenKey(room)) === "true",
        users: Object.entries(await collect(concatUserKey(room, any))).map(([name, avatar]) => ({
            name,
            avatar
        })),
        votes,
        voted: Object.fromEntries(Object.keys(votes).map(user => [user, true])),
    }

    if (Object.keys(data.votes).length !== Object.keys(data.voted).length) {
        throw new Error(`Room ${room} is missing votes ...`)
    }

    if (Object.keys(data.users).length < Object.keys(data.voted).length) {
        throw new Error(`Room ${room} is missing users ...`)
    }

    return data
}

export async function getVotes(room: string): Promise<Votes> {
    return await collect(concatVoteKey(room, any))
}

async function collect(pattern: string): Promise<{ [key: string]: string }> {
    return new Promise((resolve, reject) => {
        const keys: string[] = []
        const stream = redis.scanStream({match: pattern})
        stream.on('data', (found) => keys.push(...found))
        stream.on('error', reject)
        stream.on("end", async () => {
            const result: { [keys: string]: string } = {}
            if (!keys.length) return resolve(result)
            const values = await redis.mget(keys)
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


async function exists(key: string): Promise<boolean> {
    return (await redis.exists(key)) > 0
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
