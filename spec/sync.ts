import {RoomEvent, RoomState, Votes} from './types'

/**
 * Keeps the state of a room up to date on a client: full states replace it, events change it.
 *
 * Events can get lost or arrive late. Hence, an event is only applied if it is exactly the next version. If it is
 * further ahead (also the heartbeat), the client missed something and must ask for the full state (resync).
 */
export class RoomSync {
    state?: RoomState
    // Latest version announced by any event, to notice a full state that is already outdated when it arrives
    private seen?: {id: string; version: number}

    reset() {
        this.state = undefined
        this.seen = undefined
    }

    // Returns whether the client must ask for the full state again
    snapshot(state: RoomState): boolean {
        const current = this.state
        if (current && current.id === state.id && current.version > state.version) return false

        this.state = {...state, votes: inJoinOrder(state.votes, state)}
        return !!this.seen && this.seen.id === state.id && this.seen.version > state.version
    }

    event(event: RoomEvent): 'applied' | 'ignored' | 'resync' {
        if (!this.seen || this.seen.id !== event.id || this.seen.version < event.version) {
            this.seen = {id: event.id, version: event.version}
        }

        // Still waiting for the first full state
        const state = this.state
        if (!state) return 'ignored'

        if (state.id !== event.id) return 'resync'
        if (event.version <= state.version) return 'ignored'
        if (event.type === 'version' || event.version > state.version + 1) return 'resync'

        this.state = apply(state, event)
        return 'applied'
    }
}

function apply(state: RoomState, event: RoomEvent): RoomState {
    const next: RoomState = {...state, version: event.version}

    // Hidden votes and comments are unknown to clients
    const hide = () => {
        next.hidden = true
        next.votes = {}
        next.comments = []
    }

    switch (event.type) {
        case 'joined':
            next.users = [...state.users, {name: event.user, online: true}]
            hide()
            break

        case 'online':
        case 'offline':
            next.users = state.users.map(it => (it.name === event.user ? {...it, online: event.type === 'online'} : it))
            break

        case 'left':
            next.users = state.users.filter(it => it.name !== event.user)
            next.voted = without(state.voted, event.user)
            next.votes = without(state.votes, event.user)
            if (event.comments) next.comments = event.comments
            break

        case 'voted':
            next.voted = {...state.voted, [event.user]: true}
            hide()
            break

        case 'shown':
            next.hidden = false
            next.votes = inJoinOrder(event.votes, state)
            next.comments = event.comments
            break

        case 'hidden':
            hide()
            break
    }

    return next
}

// Votes in the order the users joined, however they arrive, so that every client lists them the same way
function inJoinOrder(votes: Votes, state: RoomState): Votes {
    const ordered: Votes = {}
    for (const user of state.users) {
        const vote = votes[user.name]
        if (vote !== undefined) ordered[user.name] = vote
    }
    return {...ordered, ...votes}
}

function without<T>(object: {[key: string]: T}, key: string) {
    const copy = {...object}
    delete copy[key]
    return copy
}
