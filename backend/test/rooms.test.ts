import {afterAll, beforeAll, describe, expect, test, vi} from 'vitest'
import {REDIS, unique} from './harness'
import type {Rooms} from '../src/store/rooms'
import {RoomGone, StoreEvent} from '../src/store/types'

// The room operations directly on Redis, without a server
describe('rooms', () => {
    let rooms: Rooms
    const events: {[room: string]: StoreEvent[]} = {}
    const connection = (name: string) => ({session: name, socket: name})

    beforeAll(async () => {
        process.env.STOETZMS_GRADING_POKER_REDIS_HOST = REDIS.host
        process.env.STOETZMS_GRADING_POKER_REDIS_PORT = REDIS.port
        rooms = new (await import('../src/store/rooms')).Rooms(600, 2)
        await rooms.init()
        rooms.onEvent((room, event) => (events[room] ??= []).push(event))
    })
    afterAll(() => rooms.close())

    test('every change is published with the next version', async () => {
        const room = unique('room')
        await rooms.subscribe(room)

        expect(await rooms.join(room, 'alice', connection('a'))).toBe('joined')
        expect(await rooms.join(room, 'bob', connection('b'))).toBe('joined')
        await rooms.vote(room, 'alice', '1.0')
        await rooms.setHidden(room, false)
        await rooms.leave(room, 'bob', 'alice')

        await vi.waitFor(() => expect(events[room]).toHaveLength(5))
        expect(events[room]!.map(it => [it.type, 'version' in it && it.version])).toEqual([
            ['joined', 1],
            ['joined', 2],
            ['voted', 3],
            ['shown', 4],
            ['left', 5],
        ])
        expect(events[room]![3]).toMatchObject({votes: {alice: '1.0'}})
        expect(events[room]![4]).toMatchObject({user: 'bob', by: 'alice'})
        expect((await rooms.getRoom(room)).version).toBe(5)
    })

    test('operations which change nothing are not published', async () => {
        const room = unique('room')
        await rooms.join(room, 'alice', connection('a'))

        await rooms.setHidden(room, true)
        await rooms.comment(room, 'alice', 'my comment')
        await rooms.leave(room, 'nobody')
        await rooms.disconnect(room, 'alice', 'another socket', 'leave')

        const data = await rooms.getRoom(room)
        expect(data.version).toBe(1)
        expect(data.comments).toEqual({alice: 'my comment'})
    })

    test('concurrent votes never conflict', async () => {
        const room = unique('room')
        const users = Array.from({length: 200}, (_, i) => `user ${i}`)
        for (const user of users) await rooms.join(room, user, connection(user))

        await Promise.all(users.map(user => rooms.vote(room, user, '2.0')))

        const data = await rooms.getRoom(room)
        expect(Object.keys(data.votes)).toHaveLength(200)
        expect(data.version).toBe(400)
        expect(data.users.map(it => it.name)).toEqual(users)
    })

    test('a user name is taken by one session only', async () => {
        const room = unique('room')
        expect(await rooms.join(room, 'alice', connection('a'))).toBe('joined')
        expect(await rooms.join(room, 'alice', connection('b'))).toBe('collision')
        expect(await rooms.join(room, 'alice', {session: 'a', socket: 'a2'})).toBe('takeover')
        expect((await rooms.getRoom(room)).users).toEqual([{name: 'alice', online: true}])
    })

    test('comments are locked while votes are shown', async () => {
        const room = unique('room')
        await rooms.join(room, 'alice', connection('a'))
        await rooms.setHidden(room, false)
        expect(await rooms.comment(room, 'alice', 'too late')).toBe('shown')
        expect((await rooms.getRoom(room)).comments).toEqual({})
    })

    test('offline users are removed after their grace period', async () => {
        const room = unique('room')
        await rooms.join(room, 'alice', connection('a'))
        await rooms.join(room, 'bob', connection('b'))
        await rooms.vote(room, 'bob', '1.0')
        await rooms.disconnect(room, 'bob', 'b', 'offline')
        expect((await rooms.getRoom(room)).users).toEqual([
            {name: 'alice', online: true},
            {name: 'bob', online: false},
        ])

        await vi.waitFor(
            async () => {
                await rooms.sync(room)
                const data = await rooms.getRoom(room)
                expect(data.users).toEqual([{name: 'alice', online: true}])
                expect(data.votes).toEqual({})
            },
            {timeout: 5000, interval: 500}
        )
    })

    test('operations on a room which does not exist fail', async () => {
        const room = unique('room')
        await expect(rooms.vote(room, 'alice', '1.0')).rejects.toThrow(RoomGone)
        await expect(rooms.setHidden(room, false)).rejects.toThrow(RoomGone)
        await expect(rooms.getRoom(room)).rejects.toThrow(RoomGone)
        expect(await rooms.sync(room)).toBeUndefined()

        // A removed user cannot vote either
        await rooms.join(room, 'alice', connection('a'))
        await rooms.leave(room, 'alice')
        await expect(rooms.vote(room, 'alice', '1.0')).rejects.toThrow(RoomGone)
    })
})
