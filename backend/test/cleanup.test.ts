import {afterAll, beforeAll, describe, expect, test, vi} from 'vitest'
import {ClientEvents} from '../../spec/types'
import {ack, join, stores, TestServer, unique} from './harness'

const TTL = 3

describe.each(stores)('stale room cleanup (%s)', store => {
    const server = new TestServer(store, {STOETZMS_GRADING_POKER_ROOM_TTL: String(TTL)})

    beforeAll(() => server.start())
    afterAll(() => server.stop())

    test('rooms without changes are deleted after the TTL', async () => {
        const room = unique('room')
        const alice = server.client()
        await join(alice, room, 'alice')
        await ack(alice, ClientEvents.SET_VOTE, {vote: '1.0'})
        alice.disconnect()

        // Joining after the TTL starts from scratch
        await vi.waitFor(
            async () => {
                const bob = server.client()
                await join(bob, room, 'bob')
                bob.disconnect()
                expect(bob.state?.users.map(it => it.name)).toEqual(['bob'])
                expect(bob.state?.voted).toEqual({})
            },
            {timeout: (TTL * 3 + 2) * 1000, interval: 1000}
        )
    })

    test('changes keep a room alive', async () => {
        const room = unique('room')
        const alice = server.client()
        await join(alice, room, 'alice')

        // Keep changing the room for longer than the TTL
        for (let i = 0; i < TTL * 2; i++) {
            await ack(alice, ClientEvents.SET_VOTE, {vote: i % 2 ? '1.0' : '2.0'})
            await new Promise(resolve => setTimeout(resolve, 700))
        }

        const bob = server.client()
        await join(bob, room, 'bob')
        expect(bob.state?.users.map(it => it.name)).toEqual(['alice', 'bob'])
    })
})
