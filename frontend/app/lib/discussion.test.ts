import {describe, expect, test} from 'vitest'
import {findDiscussion, position} from './discussion'

describe('position', () => {
    test.each([
        ['1.0', 0],
        ['3.0', 0.5],
        ['5.0', 1],
        ['Passed', 0],
        ['Rework', 0.5],
        ['Failed', 1],
        ['Supervisor', undefined],
        ['Withhold', undefined],
        ['Viewer', undefined],
    ])('%s -> %s', (vote, expected) => {
        expect(position(vote)).toBe(expected)
    })
})

describe('findDiscussion', () => {
    test('the two most opposite grades discuss', () => {
        expect(findDiscussion({alice: '1.0', bob: '2.3', carol: '4.0', dave: '3.0'})).toEqual({
            low: {vote: '1.0', users: ['alice']},
            high: {vote: '4.0', users: ['carol']},
        })
    })

    test('the example: 1.0 or Passed vs 4.0 and Failed, all others in between', () => {
        expect(findDiscussion({alice: 'Passed', bob: 'Rework', carol: 'Failed'})).toEqual({
            low: {vote: 'Passed', users: ['alice']},
            high: {vote: 'Failed', users: ['carol']},
        })
        expect(findDiscussion({alice: '1.0', bob: '2.0', carol: 'Failed'})?.high.users).toEqual(['carol'])
    })

    test('ties at an extreme include everyone at that extreme', () => {
        expect(findDiscussion({alice: '1.3', bob: '1.3', carol: '2.0'})).toEqual({
            low: {vote: '1.3', users: ['alice', 'bob']},
            high: {vote: '2.0', users: ['carol']},
        })
    })

    test('no discussion on consensus or without opinions', () => {
        expect(findDiscussion({alice: '1.7', bob: '1.7'})).toBeUndefined()
        expect(findDiscussion({alice: 'Withhold', bob: 'Supervisor'})).toBeUndefined()
        expect(findDiscussion({})).toBeUndefined()
    })

    test('general votes are ignored', () => {
        expect(findDiscussion({alice: '1.0', bob: 'Withhold', carol: '1.0'})).toBeUndefined()
        expect(findDiscussion({alice: '1.0', bob: 'Viewer', carol: '2.7'})).toEqual({
            low: {vote: '1.0', users: ['alice']},
            high: {vote: '2.7', users: ['carol']},
        })
    })
})
