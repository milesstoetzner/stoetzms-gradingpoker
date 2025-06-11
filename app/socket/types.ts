export enum ClientEvents {
    JOIN_ROOM = 'join-room',

    SET_VOTE = 'set-vote',
    SHOW_VOTES = 'show-votes',
    HIDE_VOTES = 'hide-votes',
}

export enum ServerEvents {
    INIT_STATE = 'init-state',

    ADD_USER = 'add-user',
    REMOVE_USER = 'remove-user',

    SET_VOTE = 'set-vote',
    SHOW_VOTES = 'show-votes',
    HIDE_VOTES = 'hide-votes',
}

export type JoinRoom = {
    room: string
    user: string
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

// TODO: some command to clear server state?

export interface ClientToServerEvents {
    [ClientEvents.JOIN_ROOM]: (data: JoinRoom) => void;

    [ClientEvents.SET_VOTE]: (data: Omit<SetVote, 'user'>) => void;
    [ClientEvents.SHOW_VOTES]: () => void;
    [ClientEvents.HIDE_VOTES]: () => void;
}

export interface ServerToClientEvents {
    [ServerEvents.INIT_STATE]: (data: InitState) => void;

    [ServerEvents.ADD_USER]: (data: AddUser) => void;
    [ServerEvents.REMOVE_USER]: (data: RemoveUser) => void;

    [ServerEvents.SET_VOTE]: (data: SetVote) => void;
    [ServerEvents.SHOW_VOTES]: () => void;
    [ServerEvents.HIDE_VOTES]: () => void;
}
