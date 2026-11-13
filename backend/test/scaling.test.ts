import {afterAll, beforeAll, describe, expect, test, vi} from 'vitest'
import {ClientEvents, ServerEvents} from '../../spec/types'
import {ack, drop, join, next, TestServer, unique} from './harness'

// Multiple servers only make sense with a shared persistency
describe.runIf(process.env.TEST_REDIS_PORT)('multiple servers (redis)', () => {
    const a = new TestServer('redis')
    const b = new TestServer('redis')

    beforeAll(() => Promise.all([a.start(), b.start()]))
    afterAll(() => Promise.all([a.stop(), b.stop()]))

    test('health endpoints', async () => {
        for (const server of [a, b]) {
            expect((await fetch(`http://localhost:${server.port}/healthz`)).status).toBe(200)
            expect((await fetch(`http://localhost:${server.port}/readyz`)).status).toBe(200)
        }
    })
})
