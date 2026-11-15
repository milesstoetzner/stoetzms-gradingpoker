import {describe, expect, test} from 'vitest'
import {summarize} from './statistics'

describe('statistics', () => {
    test('summarizes grades', () => {
        const result = summarize({alice: '1.7', bob: '2.0', carol: '2.3', dave: '1.7', erin: '3.0'})

        expect(result.strings).toHaveLength(5)
        expect(result.average).toBe('2.14')
        expect(result.median).toBe('2.00')
        expect(result.most).toEqual([{vote: '1.7', absolute: 2, relative: '40%'}])
        expect(result.distribution.map(share => [share.vote, share.absolute, share.relative])).toEqual([
            ['1.7', 2, '40%'],
            ['2.0', 1, '20%'],
            ['2.3', 1, '20%'],
            ['3.0', 1, '20%'],
        ])
    })

    test('counts votes that are no grades, but keeps them out of average and median', () => {
        const result = summarize({alice: 'Supervisor', bob: '1.3', carol: '1.3', dave: '2.0', erin: 'Failed'})

        expect(result.strings).toHaveLength(5)
        expect(result.numbers).toEqual([1.3, 1.3, 2.0])
        expect(result.average).toBe('1.53')
        expect(result.median).toBe('1.30')
        expect(result.most.map(share => share.vote)).toEqual(['1.3'])
    })

    test('lists every vote as most frequent on a tie', () => {
        const result = summarize({alice: '1.0', bob: '2.0'})
        expect(result.most.map(share => share.vote)).toEqual(['1.0', '2.0'])
    })

    test('has no average without grades and nothing without votes', () => {
        expect(summarize({alice: 'Passed'}).average).toBe('(no numeric votes)')
        expect(summarize({alice: 'Passed'}).median).toBe('(no numeric votes)')

        const empty = summarize({})
        expect(empty.distribution).toEqual([])
        expect(empty.most).toEqual([])
    })
})
