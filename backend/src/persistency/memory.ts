import {revision, Room, Store} from './types'

/**
 * Keeps rooms in the memory of this server. Write compares and stores synchronously, hence, atomically.
 */
export class MemoryStore implements Store {
    private readonly rooms = new Map<string, Room>()

    async init() {
        // no-op
    }

    async close() {
        // no-op
    }

    async health() {
        return true
    }

    async get(name: string) {
        return structuredClone(this.rooms.get(name))
    }

    async write(name: string, room: Room, expected: Room | undefined) {
        if (revision(this.rooms.get(name)) !== revision(expected)) return false
        this.rooms.set(name, structuredClone(room))
        return true
    }

    async delete(name: string) {
        this.rooms.delete(name)
    }
}
