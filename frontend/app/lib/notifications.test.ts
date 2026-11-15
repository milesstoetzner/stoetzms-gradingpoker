import {describe as group, expect, test} from 'vitest'
import {RoomState} from '../../../spec/types'
import {describe} from './notifications'

const room = (overrides: Partial<RoomState> = {}): RoomState => ({
    id: 'room',
    version: 1,
    hidden: true,
    users: ['anna', 'jonas', 'lena'].map(name => ({name, online: true})),
    votes: {},
    voted: {},
    comments: [],
    ...overrides,
})
const at = {id: 'room', version: 2}

group('notifications', () => {
    test('someone joins or leaves', () => {
        expect(describe({...at, type: 'joined', user: 'jonas'}, room(), room(), 'anna')).toBe('jonas joined ...')
        expect(describe({...at, type: 'left', user: 'jonas'}, room(), room(), 'anna')).toBe('jonas left ...')
        expect(describe({...at, type: 'left', user: 'jonas', by: 'lena'}, room(), room(), 'anna')).toBe(
            'lena removed jonas ...'
        )
    })

    test('own actions and own removals are not announced', () => {
        expect(describe({...at, type: 'joined', user: 'anna'}, room(), room(), 'anna')).toBeUndefined()
        expect(describe({...at, type: 'left', user: 'jonas', by: 'anna'}, room(), room(), 'anna')).toBeUndefined()
        expect(describe({...at, type: 'left', user: 'anna', by: 'lena'}, room(), room(), 'anna')).toBeUndefined()
        expect(describe({...at, type: 'hidden', by: 'anna'}, room(), room(), 'anna')).toBeUndefined()
    })

    test('someone shows or hides the votes', () => {
        const shown = {...at, type: 'shown' as const, votes: {}, comments: [], by: 'lena'}
        expect(describe(shown, room(), room({hidden: false}), 'anna')).toBe('lena showed the votes ...')
        expect(describe({...at, type: 'hidden', by: 'lena'}, room({hidden: false}), room(), 'anna')).toBe(
            'lena hid the votes ...'
        )
    })

    test('a vote while the votes are shown hides them again', () => {
        const event = {...at, type: 'voted' as const, user: 'jonas'}
        expect(describe(event, room({hidden: false}), room(), 'anna')).toBe(
            'jonas changed their vote, the votes are hidden ...'
        )
    })

    test('the last vote of a round is announced, single votes are not', () => {
        const before = room({voted: {anna: true, jonas: true}})
        const after = room({voted: {anna: true, jonas: true, lena: true}})
        expect(describe({...at, type: 'voted', user: 'lena'}, before, after, 'anna')).toBe('Everyone voted ...')
        expect(
            describe({...at, type: 'voted', user: 'jonas'}, room(), room({voted: {jonas: true}}), 'anna')
        ).toBeUndefined()
        // Changing a vote after everyone voted is not announced again
        expect(describe({...at, type: 'voted', user: 'lena'}, after, after, 'anna')).toBeUndefined()
    })
})
