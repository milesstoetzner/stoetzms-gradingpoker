import {RoomEvent, User, Votes} from '../../../spec/types'

/**
 * State of a room as read from the store (all votes and comments, even if hidden).
 */
export type RoomData = {
    // Changes when a room is recreated (e.g., closed and joined again)
    id: string
    // Increases with every change
    version: number
    hidden: boolean
    // In join order
    users: User[]
    votes: Votes
    // user -> comment, the author never leaves the server
    comments: {[user: string]: string}
}

export type Seed = {
    hidden: boolean
    users: string[]
    votes: Votes
}

// Identifies the connection of a user: the session (per browser) and the socket (per connection)
export type Connection = {
    session: string
    socket: string
}

// takeover: the user already existed with the same session (e.g., reconnect) and kept their vote
export type JoinResult = 'joined' | 'takeover' | 'collision'

/**
 * A change of a room as published by the store. Besides the events for clients, it tells the servers which sockets
 * to disconnect: the previous sockets of a taken over user, the sockets of a removed user and everyone in a closed
 * room.
 */
export type StoreEvent =
    | Exclude<RoomEvent, {type: 'online'} | {type: 'left'} | {type: 'version'}>
    | {type: 'takeover'; id: string; version: number; user: string; socket: string}
    | {type: 'left'; id: string; version: number; user: string; by?: string; comments?: string[]}
    | {type: 'closed'; id: string}

export class RoomGone extends Error {
    constructor() {
        super('Room is gone ...')
    }
}
