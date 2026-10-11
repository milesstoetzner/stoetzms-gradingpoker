import {afterAll, beforeAll, describe, expect, test} from 'vitest'
import {ClientEvents, Room, ServerEvents} from '../../spec/types'
import {ack, join, next, persistencies, sleep, TestServer, unique} from './harness'

describe.each(persistencies)('server (%s)', persistency => {
    const server = new TestServer(persistency)

    beforeAll(() => server.start())
    afterAll(() => server.stop())

    test('join, vote and show votes', async () => {
        const room = unique('room')
        const alice = server.client()
        const bob = server.client()

        expect(await join(alice, room, 'alice')).toEqual({ok: true})
        expect(await join(bob, room, 'bob')).toEqual({ok: true})

        const voted = next(bob, ServerEvents.SET_VOTED)
        expect(await ack(alice, ClientEvents.SET_VOTE, {vote: '1.3'})).toEqual({ok: true})
        expect(await voted).toEqual({user: 'alice'})

        const shown = next(bob, ServerEvents.SHOW_VOTES)
        expect(await ack(alice, ClientEvents.SHOW_VOTES)).toEqual({ok: true})
        expect(await shown).toEqual({alice: '1.3'})
    })

    test('removing a user removes the target, not the requester', async () => {
        const room = unique('room')
        const alice = server.client()
        const bob = server.client()
        const carol = server.client()

        await join(alice, room, 'alice')
        await join(bob, room, 'bob')
        await join(carol, room, 'carol')
        await ack(alice, ClientEvents.SET_VOTE, {vote: '2.0'})

        const disconnected = next(bob, 'disconnect')
        expect(await ack(alice, ClientEvents.REMOVE_USER, {user: 'bob'})).toEqual({ok: true})
        await disconnected
        expect(bob.notifications).toContain('You have been removed by alice ...')

        const state = next<Room>(carol, ServerEvents.INIT_STATE)
        await ack(carol, ClientEvents.INIT_STATE)
        const room_ = await state
        expect(room_.users.map(it => it.name).sort()).toEqual(['alice', 'carol'])
        expect(room_.voted).toEqual({alice: true})
    })

    test('rate limited requests are rejected and not applied', async () => {
        const room = unique('room')
        const alice = server.client()
        const bob = server.client()
        await join(alice, room, 'alice')
        await join(bob, room, 'bob')

        // join consumed 1 of 30 tokens
        for (let i = 0; i < 29; i++) await ack(alice, ClientEvents.INIT_STATE)

        // Limited: no ack, no state change
        await expect(ack(alice, ClientEvents.SET_VOTE, {vote: '1.0'})).rejects.toThrow()
        expect(alice.notifications).toContain('Too many requests ...')

        const state = next<Room>(bob, ServerEvents.INIT_STATE)
        await ack(bob, ClientEvents.INIT_STATE)
        expect((await state).voted).toEqual({})
    })

    test.each([
        ['room', '*'],
        ['room', 'a:b'],
        ['room', '   '],
        ['room', 'x'.repeat(65)],
        ['user', 'evil*'],
        ['user', ''],
    ])('invalid %s name %j is rejected', async (field, value) => {
        const client = server.client()
        const input = {room: unique('room'), user: 'alice', [field]: value}
        await expect(join(client, input.room, input.user)).rejects.toThrow()
        await sleep(50)
        expect(client.notifications[0]).toMatch(new RegExp(`^Invalid ${field}`))
    })

    test('unknown votes are rejected', async () => {
        const alice = server.client()
        await join(alice, unique('room'), 'alice')
        await expect(ack(alice, ClientEvents.SET_VOTE, {vote: 'x'.repeat(10000)})).rejects.toThrow()
        await sleep(50)
        expect(alice.notifications).toContain('Invalid vote: Unknown vote')
    })

    test('names are trimmed', async () => {
        const room = unique('room')
        const alice = server.client()
        const state = next<Room>(alice, ServerEvents.INIT_STATE)
        await join(alice, `  ${room} `, '  alice ')
        expect((await state).users.map(it => it.name)).toEqual(['alice'])
    })

    test('concurrent joins with the same name admit exactly one user', async () => {
        const room = unique('room')

        // Warm up the room lock with a few operations first
        const warm = server.client()
        await join(warm, room, 'warm')
        await Promise.all([1, 2, 3].map(() => ack(warm, ClientEvents.HIDE_VOTES)))

        const clients = Array.from({length: 10}, () => server.client())
        const results = await Promise.allSettled(clients.map(it => join(it, room, 'same')))
        expect(results.filter(it => it.status === 'fulfilled')).toHaveLength(1)

        await sleep(100)
        const state = next<Room>(warm, ServerEvents.INIT_STATE)
        await ack(warm, ClientEvents.INIT_STATE)
        expect((await state).users.filter(it => it.name === 'same')).toHaveLength(1)
    })

    test('a socket cannot join twice', async () => {
        const room = unique('room')
        const alice = server.client()
        await join(alice, room, 'alice')
        await expect(join(alice, room, 'mallory')).rejects.toThrow()
        expect(alice.notifications).toContain('Already joined a room ...')
    })

    test('own vote survives a refresh while votes are hidden', async () => {
        const room = unique('room')
        const alice = server.client()
        const bob = server.client()
        await join(alice, room, 'alice')
        await join(bob, room, 'bob')
        await ack(alice, ClientEvents.SET_VOTE, {vote: '1.7'})
        await ack(bob, ClientEvents.SET_VOTE, {vote: '3.0'})

        const state = next<Room>(alice, ServerEvents.INIT_STATE)
        await ack(alice, ClientEvents.INIT_STATE)
        const room_ = await state
        expect(room_.hidden).toBe(true)
        expect(room_.votes).toEqual({alice: '1.7'})
        expect(room_.voted).toEqual({alice: true, bob: true})
    })

    test('closing a room notifies everyone', async () => {
        const room = unique('room')
        const alice = server.client()
        const bob = server.client()
        await join(alice, room, 'alice')
        await join(bob, room, 'bob')

        const closed = next(bob, ServerEvents.CLOSE_ROOM)
        await ack(alice, ClientEvents.CLOSE_ROOM)
        await closed
    })
})
