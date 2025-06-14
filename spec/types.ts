export enum ClientEvents {
    JOIN_ROOM = 'join-room',
    INIT_STATE = 'init-state',

    SET_VOTE = 'set-vote',
    SHOW_VOTES = 'show-votes',
    HIDE_VOTES = 'hide-votes',

    CLOSE_ROOM = 'close-room',

    HEALTH = 'health',
}

export enum ServerEvents {
    INIT_STATE = 'init-state',
    CLOSE_ROOM = 'close-room',

    ADD_USER = 'add-user',
    REMOVE_USER = 'remove-user',

    SET_VOTED = 'set-voted',
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

export type Room = {
    hidden: boolean
    users: User[]
    votes: Votes
    voted: Voted
}

export type Votes = { [user: string]: string }
export type Voted = { [user: string]: boolean }

export type SetVote = {
    vote: string
}

export type SetVoted = {
    user: string
}


export type AddUser = User

export type RemoveUser = {
    user: string
}

export type User = {
    name: string
    avatar: string
}

export type Ack = (data: Response) => void

export type Response = {
    ok: boolean
}

export type Notification = {
    message: string
}

export const HIDDEN = '*******'

export interface ClientToServerEvents {
    [ClientEvents.JOIN_ROOM]: (data: JoinRoom, ack: Ack) => void;
    [ClientEvents.INIT_STATE]: () => void;
    [ClientEvents.CLOSE_ROOM]: (ack: Ack) => void;

    [ClientEvents.SET_VOTE]: (data: SetVote) => void;
    [ClientEvents.SHOW_VOTES]: () => void;
    [ClientEvents.HIDE_VOTES]: () => void;

    [ClientEvents.HEALTH]: (ack: Ack) => void;
}

export interface ServerToClientEvents {
    [ServerEvents.INIT_STATE]: (data: Room) => void;
    [ServerEvents.CLOSE_ROOM]: () => void;

    [ServerEvents.ADD_USER]: (data: AddUser) => void;
    [ServerEvents.REMOVE_USER]: (data: RemoveUser) => void;

    [ServerEvents.SET_VOTED]: (data: SetVoted) => void;
    [ServerEvents.SHOW_VOTES]: (data: Votes) => void;
    [ServerEvents.HIDE_VOTES]: () => void;

    [ServerEvents.SHOW_NOTIFICATION]: (data: Notification, ack?: Ack) => void;

    [ServerEvents.RECONNECT]: (attempt: number) => void;
}
