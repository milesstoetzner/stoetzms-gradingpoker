import {RoomState} from '../../spec/types'
import {RoomData} from './store/types'

/**
 * Converts the room into the state sent to the recipient: votes are only included if they are shown, except for the
 * vote of the recipient.
 *
 * Comments are anonymous: they are only included once votes are shown, without their authors and sorted by content
 * (join or write order would reveal who wrote them). Whether someone commented is never sent.
 */
export function toState(data: RoomData, recipient: string): RoomState {
    const ownVote = data.votes[recipient]
    return {
        id: data.id,
        version: data.version,
        hidden: data.hidden,
        users: data.users,
        votes: !data.hidden ? data.votes : ownVote === undefined ? {} : {[recipient]: ownVote},
        voted: Object.fromEntries(Object.keys(data.votes).map(user => [user, true])),
        comments: data.hidden ? [] : Object.values(data.comments).sort(),
        comment: data.comments[recipient] ?? '',
    }
}
