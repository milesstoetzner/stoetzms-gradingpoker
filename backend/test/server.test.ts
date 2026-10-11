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
