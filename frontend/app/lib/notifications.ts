import {RoomEvent, RoomState} from '../../../spec/types'

/**
 * What to tell the user about a change of the room made by someone else, if anything.
 *
 * Own actions are not announced (the user knows, or got their own notification), and neither are comments (that would
 * reveal who wrote them) nor single votes (too many). Offline and back online is visible at the user's row.
 *
 * before and after: the state of the room right before and after the event
 */
export function describe(event: RoomEvent, before: RoomState, after: RoomState, me: string): string | undefined {
    switch (event.type) {
        case 'joined':
            if (event.user !== me) return `${event.user} joined ...`
            return

        case 'left':
            if (event.user === me || event.by === me) return
            return event.by ? `${event.by} removed ${event.user} ...` : `${event.user} left ...`

        case 'shown':
            if (event.by && event.by !== me) return `${event.by} showed the votes ...`
            return

        case 'hidden':
            if (event.by && event.by !== me) return `${event.by} hid the votes ...`
            return

        case 'voted':
            // A vote while the votes are shown hides them again
            if (!before.hidden && event.user !== me) return `${event.user} changed their vote, the votes are hidden ...`
            if (everyoneVoted(after) && !everyoneVoted(before)) return 'Everyone voted ...'
            return
    }
}

function everyoneVoted(state: RoomState) {
    return state.users.length > 1 && state.users.every(user => state.voted[user.name])
}
