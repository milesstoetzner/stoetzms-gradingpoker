import {describe, expect, test} from 'vitest'
import {MemoryStore} from '../src/persistency/memory'
import {Rooms} from '../src/persistency/rooms'
import {Room, RoomBusy} from '../src/persistency/types'

// Memory store whose next writes fail, as if another server changed the room meanwhile
class ConflictingStore extends MemoryStore {
    conflicts = 0

    async write(name: string, room: Room, expected: Room | undefined) {
        if (this.conflicts > 0) {
            this.conflicts--
            return false
        }
        return super.write(name, room, expected)
    }
}

describe('conflicts', () => {
    test('a vote starts over after a conflict', async () => {
        const store = new ConflictingStore()
        const rooms = new Rooms(store)
        await rooms.join('room', {name: 'alice', avatar: ''}, {session: 'a', socket: 'a'})

        store.conflicts = 2
        expect((await rooms.vote('room', 'alice', '1.0')).votes).toEqual({alice: '1.0'})
    })

    test('a vote which keeps conflicting fails with RoomBusy and is not applied', async () => {
        const store = new ConflictingStore()
        const rooms = new Rooms(store)
        await rooms.join('room', {name: 'alice', avatar: ''}, {session: 'a', socket: 'a'})

        store.conflicts = 3
        await expect(rooms.vote('room', 'alice', '1.0')).rejects.toThrow(RoomBusy)
        expect((await rooms.getRoom('room')).votes).toEqual({})

        // Clicking again works
        expect((await rooms.vote('room', 'alice', '1.0')).votes).toEqual({alice: '1.0'})
    })

    test('a conflicting join starts over with the latest room', async () => {
        const store = new ConflictingStore()
        const rooms = new Rooms(store)
        await rooms.join('room', {name: 'alice', avatar: ''}, {session: 'a', socket: 'a'})

        store.conflicts = 10
        const result = await rooms.join('room', {name: 'bob', avatar: ''}, {session: 'b', socket: 'b'})
        expect(result.ok).toBe(true)
        expect((await rooms.getRoom('room')).users.map(it => it.name)).toEqual(['alice', 'bob'])
    })
})
