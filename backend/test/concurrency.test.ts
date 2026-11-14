import {afterAll, beforeAll, describe, expect, test} from 'vitest'
import {ClientEvents} from '../../spec/types'
import {ack, Client, fetchState, join, TestServer, unique} from './harness'

async function voteConcurrently(clients: Client[]) {
    await Promise.all(clients.map(it => ack(it, ClientEvents.SET_VOTE, {vote: '2.0'})))
}

describe('concurrency', () => {
    const server = new TestServer()

    beforeAll(() => server.start())
    afterAll(() => server.stop())

    test('concurrent votes are all applied', async () => {
        const room = unique('room')
        const clients = Array.from({length: 20}, () => server.client())
        for (const [i, client] of clients.entries()) await join(client, room, `user ${i}`)

        await voteConcurrently(clients)

        const state = await fetchState(clients[0]!)
        expect(Object.keys(state.voted)).toHaveLength(20)
    })
})

describe('concurrency across servers', () => {
    const a = new TestServer()
    const b = new TestServer()

    beforeAll(() => Promise.all([a.start(), b.start()]))
    afterAll(() => Promise.all([a.stop(), b.stop()]))

    test('concurrent votes on different servers are all applied', async () => {
        const room = unique('room')
        const clients = Array.from({length: 20}, (_, i) => (i % 2 ? a : b).client())
        for (const [i, client] of clients.entries()) await join(client, room, `user ${i}`)

        await voteConcurrently(clients)

        const state = await fetchState(clients[0]!)
        expect(Object.keys(state.voted)).toHaveLength(20)
    })
})
