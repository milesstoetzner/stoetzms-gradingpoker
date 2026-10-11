import {User, Votes} from '../../../spec/types'

/**
 * Internal state of a room (all votes, even if hidden).
 */
export type RoomData = {
    id: string
    version: number
    hidden: boolean
    users: User[]
    votes: Votes
}

export type Seed = {
    hidden: boolean
    users: User[]
    votes: Votes
}

export class RoomGone extends Error {
    constructor() {
        super('Room is gone ...')
    }
}

export interface Lock {
    release(): Promise<void> | void
}

export interface Persistency {
    init(): Promise<void>

    close(): Promise<void>

    lock(room: string): Promise<Lock>

    health(): Promise<boolean>

    setHidden(room: string, hidden: boolean): Promise<void>

    hasUser(room: string, user: string): Promise<boolean>

    addUser(room: string, user: string, avatar: string): Promise<void>

    removeUser(room: string, user: string): Promise<void>

    setVote(room: string, user: string, vote: string): Promise<void>

    removeVote(room: string, user: string): Promise<void>

    hasRoom(room: string): Promise<boolean>

    assertRoom(room: string): Promise<void>

    // Creates the room with a new id and version 0
    addRoom(room: string, seed?: Seed): Promise<void>

    // Increments the version of the room, call once per change
    bump(room: string): Promise<void>

    getRoom(room: string): Promise<RoomData>

    deleteRoom(room: string): Promise<void>
}
