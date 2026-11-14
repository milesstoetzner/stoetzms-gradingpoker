import {BALLOT, Votes} from '../../../spec/types'

/**
 * Position of a vote on a common scale from 0 (best) to 1 (worst), so that grades and proposals can be compared.
 * General votes (Supervisor, Withhold, Viewer) are no opinion and have no position.
 */
export function position(vote: string): number | undefined {
    if ((BALLOT.Grading as readonly string[]).includes(vote)) return (Number(vote) - 1) / 4

    const proposal = (BALLOT.Proposal as readonly string[]).indexOf(vote)
    if (proposal !== -1) return proposal / (BALLOT.Proposal.length - 1)
}

export type Discussion = {
    // Users with the best vote, e.g., 1.0 or Passed
    low: {vote: string; users: string[]}
    // Users with the worst vote, e.g., 4.0 or Failed
    high: {vote: string; users: string[]}
}

/**
 * The users with the most opposite votes, who should discuss. Ties at an extreme include all of them.
 * Returns undefined if there is no disagreement (less than two different positions).
 */
export function findDiscussion(votes: Votes): Discussion | undefined {
    const positioned = Object.entries(votes)
        .map(([user, vote]) => ({user, vote, position: position(vote)}))
        .filter((it): it is {user: string; vote: string; position: number} => it.position !== undefined)
    if (!positioned.length) return

    const min = Math.min(...positioned.map(it => it.position))
    const max = Math.max(...positioned.map(it => it.position))
    if (min === max) return

    const at = (target: number) => {
        const found = positioned.filter(it => it.position === target)
        return {vote: found[0]!.vote, users: found.map(it => it.user).sort()}
    }

    return {low: at(min), high: at(max)}
}
