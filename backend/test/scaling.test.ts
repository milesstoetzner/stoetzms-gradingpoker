import {afterAll, beforeAll, describe, expect, test, vi} from 'vitest'
import {ClientEvents, ServerEvents} from '../../spec/types'
import {ack, drop, join, next, TestServer, unique} from './harness'

describe('multiple servers', () => {
    const a = new TestServer()
    const b = new TestServer()

    beforeAll(() => Promise.all([a.start(), b.start()]))
    afterAll(() => Promise.all([a.stop(), b.stop()]))

    test('room states are broadcast across servers', async () => {
        const room = unique('room')
        const alice = a.client()
        const bob = b.client()
        await join(alice, room, 'alice')
        await join(bob, room, 'bob')

        await ack(alice, ClientEvents.SET_VOTE, {vote: '1.3'})
        await vi.waitFor(() => expect(bob.state?.voted).toEqual({alice: true}))

        await ack(bob, ClientEvents.SHOW_VOTES)
        await vi.waitFor(() => expect(alice.state?.hidden).toBe(false))
        expect(alice.state?.votes).toEqual({alice: '1.3'})
        expect(alice.state?.version).toBe(bob.state?.version)
    })

    test('removing a user works across servers', async () => {
        const room = unique('room')
        const alice = a.client()
        const bob = b.client()
        await join(alice, room, 'alice')
        await join(bob, room, 'bob')

        const disconnected = next(bob, 'disconnect')
        await ack(alice, ClientEvents.REMOVE_USER, {user: 'bob'})
        await disconnected
        expect(bob.notifications).toContain('You have been removed by alice ...')
        await vi.waitFor(() => expect(alice.state?.users.map(it => it.name)).toEqual(['alice']))
    })

    test('closing a room disconnects everyone across servers', async () => {
        const room = unique('room')
        const alice = a.client()
        const bob = b.client()
        await join(alice, room, 'alice')
        await join(bob, room, 'bob')

        const closed = next(bob, ServerEvents.CLOSE_ROOM)
        const disconnected = next(bob, 'disconnect')
        await ack(alice, ClientEvents.CLOSE_ROOM).catch(() => {})
        await closed
        await disconnected
    })

    test('a user can reconnect to another server and keep their seat', async () => {
        const room = unique('room')
        const alice = a.client()
        const bob = b.client()
        await join(alice, room, 'alice')
        await join(bob, room, 'bob')
        await ack(alice, ClientEvents.SET_VOTE, {vote: '2.7'})

        await drop(alice)
        await vi.waitFor(() => expect(bob.state?.users.find(it => it.name === 'alice')?.online).toBe(false))

        const again = b.client(alice.session)
        expect(await join(again, room, 'alice')).toEqual({ok: true})
        await vi.waitFor(() => expect(bob.state?.users.find(it => it.name === 'alice')?.online).toBe(true))
        expect(again.state?.votes).toEqual({alice: '2.7'})
    })

    test('joining with the same session on another server replaces the previous connection', async () => {
        const room = unique('room')
        const first = a.client()
        await join(first, room, 'alice')

        const replaced = next(first, 'disconnect')
        const second = b.client(first.session)
        expect(await join(second, room, 'alice')).toEqual({ok: true})
        await replaced
        expect(first.notifications).toContain('You joined this room somewhere else ...')
    })

    test('health endpoints', async () => {
        for (const server of [a, b]) {
            expect((await fetch(`http://localhost:${server.port}/healthz`)).status).toBe(200)
            expect((await fetch(`http://localhost:${server.port}/readyz`)).status).toBe(200)
        }
    })
})

describe('server shutdown', () => {
    const a = new TestServer()
    const b = new TestServer()

    beforeAll(() => Promise.all([a.start(), b.start()]))
    afterAll(() => b.stop())

    test('users of a stopped server go offline and can continue on another server', async () => {
        const room = unique('room')
        const alice = a.client()
        const bob = b.client()
        await join(alice, room, 'alice')
        await join(bob, room, 'bob')
        await ack(alice, ClientEvents.SET_VOTE, {vote: '1.0'})

        await a.kill()
        await vi.waitFor(() => expect(bob.state?.users.find(it => it.name === 'alice')?.online).toBe(false))
        expect(bob.state?.voted).toEqual({alice: true})

        const again = b.client(alice.session)
        await join(again, room, 'alice')
        await vi.waitFor(() => expect(bob.state?.users.find(it => it.name === 'alice')?.online).toBe(true))
    })
})
