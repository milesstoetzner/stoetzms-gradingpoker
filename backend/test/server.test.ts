import {afterAll, beforeAll, describe, expect, test, vi} from 'vitest'
import {BALLOT_VALUES, ClientEvents, ServerEvents} from '../../spec/types'
import {ack, Client, fetchState, join, next, persistencies, sleep, TestServer, unique} from './harness'

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
        await vi.waitFor(() => expect(alice.state?.users.map(it => it.name)).toEqual(['alice', 'bob']))

        expect(await ack(alice, ClientEvents.SET_VOTE, {vote: '1.3'})).toEqual({ok: true})
        await vi.waitFor(() => expect(bob.state?.voted).toEqual({alice: true}))
        expect(bob.state?.votes).toEqual({})
        expect(alice.state?.votes).toEqual({alice: '1.3'})

        expect(await ack(alice, ClientEvents.SHOW_VOTES)).toEqual({ok: true})
        await vi.waitFor(() => expect(bob.state?.votes).toEqual({alice: '1.3'}))
        expect(bob.state?.hidden).toBe(false)
    })

    test('voting hides votes again', async () => {
        const room = unique('room')
        const alice = server.client()
        const bob = server.client()
        await join(alice, room, 'alice')
        await join(bob, room, 'bob')
        await ack(alice, ClientEvents.SET_VOTE, {vote: '1.3'})
        await ack(alice, ClientEvents.SHOW_VOTES)
        await vi.waitFor(() => expect(bob.state?.hidden).toBe(false))

        await ack(bob, ClientEvents.SET_VOTE, {vote: '2.0'})
        await vi.waitFor(() => expect(alice.state?.hidden).toBe(true))
        expect(alice.state?.votes).toEqual({})
        expect(alice.state?.voted).toEqual({alice: true, bob: true})
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
        await ack(bob, ClientEvents.SET_VOTE, {vote: '3.0'})

        const disconnected = next(bob, 'disconnect')
        expect(await ack(alice, ClientEvents.REMOVE_USER, {user: 'bob'})).toEqual({ok: true})
        await disconnected
        expect(bob.notifications).toContain('You have been removed by alice ...')

        await vi.waitFor(() => expect(carol.state?.users.map(it => it.name)).toEqual(['alice', 'carol']))
        expect(carol.state?.voted).toEqual({alice: true})
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
        expect((await fetchState(bob)).voted).toEqual({})
    })

    test.each([
        ['room', '*'],
        ['room', 'a:b'],
        ['room', 'a{b}'],
        ['room', '   '],
        ['room', 'x'.repeat(65)],
        ['user', 'evil*'],
        ['user', ''],
    ])('invalid %s name %j is rejected', async (field, value) => {
        const client = server.client()
        const input = {room: unique('room'), user: 'alice', [field]: value}
        await expect(join(client, input.room, input.user)).rejects.toThrow()
        expect(client.notifications[0]).toMatch(new RegExp(`^Invalid ${field}`))
    })

    test('unknown votes are rejected', async () => {
        const alice = server.client()
        await join(alice, unique('room'), 'alice')
        await expect(ack(alice, ClientEvents.SET_VOTE, {vote: 'x'.repeat(10000)})).rejects.toThrow()
        expect(alice.notifications).toContain('Invalid vote: Unknown vote')
    })

    test('names are trimmed', async () => {
        const alice = server.client()
        await join(alice, `  ${unique('room')} `, '  alice ')
        expect(alice.state?.users.map(it => it.name)).toEqual(['alice'])
    })

    test('concurrent joins with the same name admit exactly one user', async () => {
        const room = unique('room')
        const warm = server.client()
        await join(warm, room, 'warm')

        const clients = Array.from({length: 10}, () => server.client())
        const results = await Promise.allSettled(clients.map(it => join(it, room, 'same')))
        expect(results.filter(it => it.status === 'fulfilled')).toHaveLength(1)

        const state = await fetchState(warm)
        expect(state.users.filter(it => it.name === 'same')).toHaveLength(1)
    })

    test('concurrent joins with different names admit everyone', async () => {
        const room = unique('room')
        const clients = Array.from({length: 20}, () => server.client())
        await Promise.all(clients.map((it, i) => join(it, room, `user ${i}`)))

        const state = await fetchState(clients[0]!)
        expect(state.users).toHaveLength(20)
    })

    test('clients converge to the server state under concurrent changes', async () => {
        const room = unique('room')
        const clients: Client[] = Array.from({length: 8}, () => server.client())
        for (const [i, client] of clients.entries()) await join(client, room, `user ${i}`)

        // Every client concurrently votes, shows and hides in random order
        await Promise.all(
            clients.map(async client => {
                for (let i = 0; i < 6; i++) {
                    const r = Math.random()
                    if (r < 0.5) {
                        const vote = BALLOT_VALUES[Math.floor(Math.random() * BALLOT_VALUES.length)]
                        await ack(client, ClientEvents.SET_VOTE, {vote})
                    } else if (r < 0.75) await ack(client, ClientEvents.SHOW_VOTES)
                    else await ack(client, ClientEvents.HIDE_VOTES)
                }
            })
        )

        await sleep(200)
        const truth = await fetchState(clients[0]!)
        for (const client of clients) {
            expect(client.state?.version).toBe(truth.version)
            expect(client.state?.hidden).toBe(truth.hidden)
            expect(client.state?.voted).toEqual(truth.voted)
            expect(client.state?.users).toEqual(truth.users)
        }
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

        const state = await fetchState(alice)
        expect(state.hidden).toBe(true)
        expect(state.votes).toEqual({alice: '1.7'})
        expect(state.voted).toEqual({alice: true, bob: true})
    })

    test('closing a room notifies and disconnects everyone', async () => {
        const room = unique('room')
        const alice = server.client()
        const bob = server.client()
        await join(alice, room, 'alice')
        await join(bob, room, 'bob')

        const closed = next(bob, ServerEvents.CLOSE_ROOM)
        const disconnected = next(bob, 'disconnect')
        await expect(ack(alice, ClientEvents.CLOSE_ROOM)).rejects.toThrow()
        await closed
        await disconnected

        // The room starts from scratch afterwards
        const carol = server.client()
        await join(carol, room, 'carol')
        expect(carol.state?.users.map(it => it.name)).toEqual(['carol'])
        expect(carol.state?.voted).toEqual({})
    })

    describe('sessions', () => {
        test('joining with the same session takes over the user and replaces the previous connection', async () => {
            const room = unique('room')
            const first = server.client()
            const bob = server.client()
            await join(first, room, 'alice')
            await join(bob, room, 'bob')
            await ack(first, ClientEvents.SET_VOTE, {vote: '2.3'})
            const avatar = bob.state?.users.find(it => it.name === 'alice')?.avatar

            const replaced = next(first, 'disconnect')
            const second = server.client(first.session)
            expect(await join(second, room, 'alice')).toEqual({ok: true})
            await replaced
            expect(first.notifications).toContain('You joined this room somewhere else ...')

            // Same seat: vote and avatar kept
            const own = await fetchState(second)
            expect(own.votes).toEqual({alice: '2.3'})
            expect(own.users.find(it => it.name === 'alice')?.avatar).toBe(avatar)

            // The replaced connection must not remove the user
            await sleep(200)
            const state = await fetchState(bob)
            expect(state.users.map(it => it.name).sort()).toEqual(['alice', 'bob'])
            expect(state.voted).toEqual({alice: true})
        })

        test('another session cannot take over a user', async () => {
            const room = unique('room')
            const alice = server.client()
            await join(alice, room, 'alice')

            const mallory = server.client()
            await expect(join(mallory, room, 'alice')).rejects.toThrow()
            expect(mallory.notifications).toContain('User alice already exists ...')
        })
    })
})
