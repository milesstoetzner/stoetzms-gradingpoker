export enum ClientEvents {
    JOIN_ROOM = 'join-room',

    SET_VOTE = 'set-vote',
    SHOW_VOTES = 'show-votes',
    HIDE_VOTES = 'hide-votes',

    CLOSE_ROOM = 'close-room',

}

export enum ServerEvents {
    INIT_STATE = 'init-state',
    CLOSE_ROOM = 'close-room',

    ADD_USER = 'add-user',
    REMOVE_USER = 'remove-user',

    SET_VOTE = 'set-vote',
    SHOW_VOTES = 'show-votes',
    HIDE_VOTES = 'hide-votes',

    SHOW_NOTIFICATION = 'show-notification',

    // fix
    RECONNECT = 'reconnect',
}

export type JoinRoom = {
    room: string
    user: string
    seed?: boolean
}

export type InitState = {
    hidden: boolean
    users: User[]
    votes: Votes
}

export type Votes = { [user: string]: string }

export type SetVote = {
    user: string
    vote: string
}

export type AddUser = User

export type RemoveUser = {
    user: string
}

export type User = {
    name: string
    avatar: string
}

export type Ack = () => void

export type Notification = {
    message: string
}

export const HIDDEN = '*******'

export interface ClientToServerEvents {
    [ClientEvents.JOIN_ROOM]: (data: JoinRoom) => void;
    [ClientEvents.CLOSE_ROOM]: (ack: Ack) => void;

    [ClientEvents.SET_VOTE]: (data: Omit<SetVote, 'user'>) => void;
    [ClientEvents.SHOW_VOTES]: () => void;
    [ClientEvents.HIDE_VOTES]: () => void;
}

export interface ServerToClientEvents {
    [ServerEvents.INIT_STATE]: (data: InitState) => void;
    [ServerEvents.CLOSE_ROOM]: () => void;

    [ServerEvents.ADD_USER]: (data: AddUser) => void;
    [ServerEvents.REMOVE_USER]: (data: RemoveUser) => void;

    [ServerEvents.SET_VOTE]: (data: SetVote) => void;
    [ServerEvents.SHOW_VOTES]: () => void;
    [ServerEvents.HIDE_VOTES]: () => void;

    [ServerEvents.SHOW_NOTIFICATION]: (data: Notification) => void;

    [ServerEvents.RECONNECT]: (attempt: number) => void;
}
