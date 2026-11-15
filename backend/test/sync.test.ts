import {describe, expect, test} from 'vitest'
import {RoomSync} from '../../spec/sync'
import {RoomState} from '../../spec/types'

const state = (version: number): RoomState => ({
    id: 'room',
    version,
    hidden: true,
    users: [{name: 'alice', online: true}],
    votes: {},
    voted: {},
    comments: [],
})

describe('room sync', () => {
    test('applies the next event', () => {
        const sync = new RoomSync()
        sync.snapshot(state(1))

        expect(sync.event({type: 'joined', id: 'room', version: 2, user: 'bob'})).toBe('applied')
        expect(sync.event({type: 'voted', id: 'room', version: 3, user: 'bob'})).toBe('applied')
        expect(sync.state).toMatchObject({version: 3, voted: {bob: true}})
        expect(sync.state?.users.map(it => it.name)).toEqual(['alice', 'bob'])
    })

    test('ignores events it already knows', () => {
        const sync = new RoomSync()
        sync.snapshot(state(5))
        expect(sync.event({type: 'voted', id: 'room', version: 5, user: 'alice'})).toBe('ignored')
        expect(sync.state?.voted).toEqual({})
    })

    test('asks for the full state after a missed event', () => {
        const sync = new RoomSync()
        sync.snapshot(state(1))
        expect(sync.event({type: 'voted', id: 'room', version: 3, user: 'alice'})).toBe('resync')
        expect(sync.state?.version).toBe(1)
    })

    test('the heartbeat reveals a missed last event', () => {
        const sync = new RoomSync()
        sync.snapshot(state(1))
        expect(sync.event({type: 'version', id: 'room', version: 1})).toBe('ignored')
        expect(sync.event({type: 'version', id: 'room', version: 2})).toBe('resync')
    })

    test('asks again if the full state is older than an event seen while waiting for it', () => {
        const sync = new RoomSync()
        expect(sync.event({type: 'voted', id: 'room', version: 4, user: 'alice'})).toBe('ignored')
        expect(sync.snapshot(state(3))).toBe(true)
        expect(sync.snapshot(state(4))).toBe(false)
    })

    test('votes are listed in join order, however they arrive', () => {
        const sync = new RoomSync()
        sync.snapshot({...state(1), users: ['alice', 'bob', 'carol'].map(name => ({name, online: true}))})
        sync.event({
            type: 'shown',
            id: 'room',
            version: 2,
            votes: {carol: '3.0', alice: '1.0', bob: '2.0'},
            comments: [],
        })
        expect(Object.keys(sync.state!.votes)).toEqual(['alice', 'bob', 'carol'])

        sync.snapshot({...sync.state!, version: 3, votes: {bob: '2.0', carol: '3.0', alice: '1.0'}})
        expect(Object.keys(sync.state!.votes)).toEqual(['alice', 'bob', 'carol'])
    })

    test('a recreated room needs the full state', () => {
        const sync = new RoomSync()
        sync.snapshot(state(7))
        expect(sync.event({type: 'joined', id: 'another', version: 1, user: 'bob'})).toBe('resync')
    })

    test('showing reveals votes and comments, voting hides them again', () => {
        const sync = new RoomSync()
        sync.snapshot(state(1))
        sync.event({type: 'shown', id: 'room', version: 2, votes: {alice: '1.0'}, comments: ['a comment']})
        expect(sync.state).toMatchObject({hidden: false, votes: {alice: '1.0'}, comments: ['a comment']})

        sync.event({type: 'voted', id: 'room', version: 3, user: 'alice'})
        expect(sync.state).toMatchObject({hidden: true, votes: {}, comments: []})
    })
})
