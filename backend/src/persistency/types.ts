import {Room, Votes} from "../../../spec/types";

export interface Lock {
    release(): Promise<void> | void
}

export interface Persistency {
    init(): Promise<void>

    lock(room: string): Promise<Lock>

    health(): Promise<boolean>

    setHidden(room: string, hidden: boolean): Promise<void>

    hasUser(room: string, user: string): Promise<boolean>

    addUser(room: string, user: string, avatar: string): Promise<void>

    removeUser(room: string, user: string): Promise<void>

    setVote(room: string, user: string, vote: string): Promise<void>

    removeVote(room: string, user: string): Promise<void>

    hasRoom(room: string): Promise<boolean>

    addRoom(room: string, seed?: Room): Promise<void>

    getRoom(room: string): Promise<Room>

    getVotes(room: string): Promise<Votes>

    deleteRoom(room: string): Promise<void>
}
