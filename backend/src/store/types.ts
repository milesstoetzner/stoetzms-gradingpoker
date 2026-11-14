import {User, Votes} from '../../../spec/types'

/**
 * State of a room as returned by the operations (all votes, even if hidden).
 */
export type RoomData = {
    id: string
    version: number
    hidden: boolean
    users: User[]
    votes: Votes
    // user -> comment, the author never leaves the server
    comments: {[user: string]: string}
}

/**
 * State of a room as stored.
 */
export type Room = {
    // Changes when a room is recreated (e.g., closed and joined again)
    id: string
    // Increases with every change
    version: number
    hidden: boolean
    // In join order
    users: Member[]
    votes: Votes
    comments: {[user: string]: string}
}

export type Member = {
    name: string
    avatar: string
    // Browser session and socket of the current connection (empty for seeded users)
    session: string
    socket: string
    // Epoch seconds since the user is offline
    offline?: number
}

export type Seed = {
    hidden: boolean
    users: User[]
    votes: Votes
}

// Identifies the connection of a user: the session (per browser) and the socket (per connection)
export type Connection = {
    session: string
    socket: string
}

// takeover: the user already existed with the same session (e.g., reconnect) and kept their vote
export type JoinResult = {ok: true; room: RoomData; takeover: boolean} | {ok: false; reason: 'collision'}

export class RoomGone extends Error {
    constructor() {
        super('Room is gone ...')
    }
}

// Another server changed the room meanwhile, the operation was not applied
export class RoomBusy extends Error {
    constructor() {
        super('Room is busy, please try again ...')
    }
}

/**
 * Operations on rooms. Every operation is atomic, also across multiple servers, and returns the room as it is right
 * after the operation.
 *
 * Operations on rooms which do not exist (anymore) throw RoomGone instead of recreating them (housekeeping
 * operations like disconnect and prune return undefined instead).
 *
 * Users who lost their connection stay in the room as offline (with their vote) for a grace period. Mutating
 * operations remove offline users whose grace period ended.
 */
export interface RoomOperations {
    init(): Promise<void>

    close(): Promise<void>

    health(): Promise<boolean>

    // Creates the room if required, adds the user and hides votes, or takes over the user if the session matches
    join(room: string, user: Omit<User, 'online'>, connection: Connection, seed?: Seed): Promise<JoinResult>

    // Removes the user, their vote and their comment
    leave(room: string, user: string): Promise<RoomData>

    // Removes the user (leave) or marks them as offline, but only if the socket is still the user's current one
    disconnect(room: string, user: string, socket: string, mode: 'leave' | 'offline'): Promise<RoomData | undefined>

    // Removes offline users whose grace period ended, returns the room only if something changed
    prune(room: string): Promise<RoomData | undefined>

    // Sets the vote of the user (who must be in the room) and hides votes
    vote(room: string, user: string, vote: string): Promise<RoomData>

    // Sets (or removes, if empty) the comment of the user (who must be in the room); only while votes are hidden
    comment(room: string, user: string, comment: string): Promise<RoomData | 'shown'>

    setHidden(room: string, hidden: boolean): Promise<RoomData>

    getRoom(room: string): Promise<RoomData>

    deleteRoom(room: string): Promise<void>
}

/**
 * Where rooms are stored. Knows nothing about the rules of a room, see Rooms.
 */
export interface Store {
    init(): Promise<void>

    close(): Promise<void>

    health(): Promise<boolean>

    get(name: string): Promise<Room | undefined>

    // Stores the room, but only if the stored room is still the expected one (undefined: no room stored).
    // Returns false if another operation changed the room meanwhile.
    write(name: string, room: Room, expected: Room | undefined): Promise<boolean>

    delete(name: string): Promise<void>
}

// Identifies a state of a room, also across recreations of the room
export function revision(room: Room | undefined) {
    return room ? `${room.id}:${room.version}` : ''
}
