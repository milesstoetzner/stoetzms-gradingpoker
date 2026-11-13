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
}

export type Member = {
    name: string
    avatar: string
}

export type Seed = {
    hidden: boolean
    users: User[]
    votes: Votes
}

export type JoinResult = {ok: true; room: RoomData} | {ok: false; reason: 'collision'}

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
 * Operations on rooms which do not exist (anymore) throw RoomGone instead of recreating them.
 */
export interface Persistency {
    init(): Promise<void>

    close(): Promise<void>

    health(): Promise<boolean>

    // Creates the room if required, adds the user and hides votes
    join(room: string, user: User, seed?: Seed): Promise<JoinResult>

    // Removes the user and their vote
    leave(room: string, user: string): Promise<RoomData>

    // Sets the vote of the user (who must be in the room) and hides votes
    vote(room: string, user: string, vote: string): Promise<RoomData>

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
