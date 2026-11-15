// @ts-expect-error The package has no types
import getAverage from 'average'
// @ts-expect-error The package has no types
import getMedian from 'median'
import {Votes} from '../../../spec/types'

export type Share = {
    vote: string
    // Number of users with this vote
    absolute: number
    // Percentage of all votes, e.g., 40%
    relative: string
}

export type Statistics = {
    // All votes, as given and as text
    values: string[]
    strings: string[]
    // The votes that are grades
    numbers: number[]
    // Votes by how often they were given, most frequent first
    distribution: Share[]
    // Of the grades, with two decimals, or a note if there are none
    average: string
    median: string
    // The most frequent votes
    most: Share[]
}

const NO_NUMBERS = '(no numeric votes)'

export function summarize(votes: Votes): Statistics {
    const values = Object.values(votes)
    const strings = values.filter(vote => vote !== null && vote !== undefined && vote !== '').map(String)
    const numbers = strings.map(Number).filter(number => !Number.isNaN(number))

    const counts = new Map<string, number>()
    for (const vote of strings) counts.set(vote, (counts.get(vote) ?? 0) + 1)

    const distribution = [...counts.entries()]
        .map(([vote, absolute]) => ({vote, absolute, relative: ((absolute / strings.length) * 100).toFixed(0) + '%'}))
        .sort((a, b) => b.absolute - a.absolute)

    return {
        values,
        strings,
        numbers,
        distribution,
        average: numbers.length ? getAverage(numbers).toFixed(2) : NO_NUMBERS,
        median: numbers.length ? getMedian(numbers).toFixed(2) : NO_NUMBERS,
        most: distribution.filter(share => share.absolute === distribution[0]?.absolute),
    }
}
