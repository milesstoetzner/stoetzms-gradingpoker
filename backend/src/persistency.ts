import Redis from "ioredis";
import {Room} from "../../spec/types";
import * as config from "./config";

const redis = new Redis({
    host: config.redis
})


export async function health() {
    await redis.ping()
}

export async function setHidden(room: string, hidden: boolean) {
    await redis.set(concat('room', room, 'hidden'), String(hidden))
}

export async function addUser(room: string, user: string, avatar: string) {
    await redis.set(concat('room', room, 'users', user), avatar)
}

export async function removeUsers(room: string, user: string) {
    await redis.del(concat('room', room, 'user', user))
}

export async function setVote(room: string, user: string, vote: string) {
    const transaction = redis.multi()

    transaction.set(concat('room', room, 'users', user), "true")
    transaction.set(concat('room', room, 'users', user), vote)

    await transaction.exec()
}


// TODO: transaction?
export async function getRoom(room: string): Promise<Room> {
    const users = await collect(concat('room', room, 'users'), String)
    return {
        hidden: await redis.get(concat('room', room, 'hidden')) === "true",
        users: Object.entries(users).map(([name, avatar]) => ({name, avatar})),
        votes: await collect(concat('room', room, 'votes'), String),
        voted: await collect(concat('room', room, 'voted'), Boolean),
    }
}

async function collect<T>(pattern: string, transform: (it: string) => T): Promise<{ [key: string]: T }> {
    return new Promise((resolve, reject) => {
        const keys: string[] = []
        const stream = redis.scanStream({match: pattern})
        stream.on('data', (found) => keys.push(found))
        stream.on('error', reject)
        stream.on("end", async () => {
            const result: { [keys: string]: T } = {}
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

export async function closeRoom(room: string) {
    return new Promise((resolve, reject) => {
        const collected: string[] = []
        const stream = redis.scanStream({match: concat("room", room, "*")})
        stream.on('data', (keys) => collected.push(keys))
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

