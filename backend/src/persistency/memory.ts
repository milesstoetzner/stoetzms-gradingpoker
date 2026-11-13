import {revision, Room, Store} from './types'

/**
 * Keeps rooms in the memory of this server. Write compares and stores synchronously, hence, atomically.
 *
 * Rooms without changes for the TTL are deleted by a periodic sweep.
 */
export class MemoryStore implements Store {
    private readonly rooms = new Map<string, {room: Room; expires: number}>()
    private sweeper?: NodeJS.Timeout

    // ttl: seconds after the last change until a room is deleted
    constructor(private readonly ttl: number) {}

    async init() {
        this.sweeper = setInterval(() => this.sweep(), Math.min(this.ttl, 60 * 60) * 1000)
        this.sweeper.unref()
    }

    async close() {
        clearInterval(this.sweeper)
    }

    sweep() {
        for (const [name, {expires}] of this.rooms) {
            if (Date.now() >= expires) this.rooms.delete(name)
        }
    }

    async health() {
        return true
    }

    async get(name: string) {
        return structuredClone(this.rooms.get(name)?.room)
    }

    async write(name: string, room: Room, expected: Room | undefined) {
        if (revision(this.rooms.get(name)?.room) !== revision(expected)) return false
        this.rooms.set(name, {room: structuredClone(room), expires: Date.now() + this.ttl * 1000})
        return true
    }

    async delete(name: string) {
        this.rooms.delete(name)
    }
}
