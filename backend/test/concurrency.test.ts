import {afterAll, beforeAll, describe, expect, test} from 'vitest'
import {ClientEvents} from '../../spec/types'
import {ack, Client, fetchState, join, persistencies, TestServer, unique} from './harness'

async function voteConcurrently(clients: Client[]) {
    await Promise.all(clients.map(it => ack(it, ClientEvents.SET_VOTE, {vote: '2.0'})))
}

describe.each(persistencies)('concurrency (%s)', persistency => {
    const server = new TestServer(persistency)

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

// Multiple servers only make sense with a shared persistency
describe.runIf(process.env.TEST_REDIS_PORT)('concurrency across servers (redis)', () => {
    const a = new TestServer('redis')
    const b = new TestServer('redis')

    beforeAll(() => Promise.all([a.start(), b.start()]))
    afterAll(() => Promise.all([a.stop(), b.stop()]))

    test('concurrent votes on different servers are applied or rejected with a notification', async () => {
        const room = unique('room')
        const clients = Array.from({length: 20}, (_, i) => (i % 2 ? a : b).client())
        for (const [i, client] of clients.entries()) await join(client, room, `user ${i}`)

        // Votes conflicting with a vote on the other server are rejected, the user votes again
        const results = await Promise.allSettled(clients.map(it => ack(it, ClientEvents.SET_VOTE, {vote: '2.0'})))
        const rejected = clients.filter((_, i) => results[i]!.status === 'rejected')
        if (process.env.TEST_REPORT_CONFLICTS) console.log('rejected votes:', rejected.length)
        for (const client of rejected) {
            expect(client.notifications).toContain('Room is busy, please try again ...')
            await ack(client, ClientEvents.SET_VOTE, {vote: '2.0'})
        }

        const state = await fetchState(clients[0]!)
        expect(Object.keys(state.voted)).toHaveLength(20)
    })
})
