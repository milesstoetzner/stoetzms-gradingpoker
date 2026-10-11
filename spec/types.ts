export enum ClientEvents {
    JOIN_ROOM = 'join-room',
    INIT_STATE = 'init-state',

    SET_VOTE = 'set-vote',
    SHOW_VOTES = 'show-votes',
    HIDE_VOTES = 'hide-votes',

    CLOSE_ROOM = 'close-room',
    REMOVE_USER = 'remove-user',

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

export const BALLOT = {
    General: ['Supervisor', 'Withhold', 'Viewer'],
    Proposal: ['Passed', 'Rework', 'Failed'],
    Grading: ['1.0', '1.3', '1.7', '2.0', '2.3', '2.7', '3.0', '3.3', '3.7', '4.0', '5.0'],
} as const

export const BALLOT_VALUES: readonly string[] = Object.values(BALLOT).flat()

// Letters, numbers, spaces and . _ ' - (no glob or key separator characters)
export const NAME_PATTERN = /^[\p{L}\p{N}\p{M} ._'-]+$/u
export const NAME_MAX_LENGTH = 64

export function validateName(name: string): string | undefined {
    const trimmed = name.trim()
    if (!trimmed) return 'Must not be empty'
    if (trimmed.length > NAME_MAX_LENGTH) return `Must be at most ${NAME_MAX_LENGTH} characters`
    if (!NAME_PATTERN.test(trimmed)) return "Only letters, numbers, spaces and . _ ' - are allowed"
}

export interface ClientToServerEvents {
    [ClientEvents.JOIN_ROOM]: (data: JoinRoom, ack: Ack) => void;
    [ClientEvents.INIT_STATE]: (ack: Ack) => void;
    [ClientEvents.CLOSE_ROOM]: (ack: Ack) => void;
    [ClientEvents.REMOVE_USER]: (data: RemoveUser, ack: Ack) => void;

    [ClientEvents.SET_VOTE]: (data: SetVote, ack: Ack) => void;
    [ClientEvents.SHOW_VOTES]: (ack: Ack) => void;
    [ClientEvents.HIDE_VOTES]: (ack: Ack) => void;

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
