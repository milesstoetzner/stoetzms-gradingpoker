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
    // Full room state after every change, see RoomState
    ROOM_STATE = 'room-state',
    CLOSE_ROOM = 'close-room',

    SHOW_NOTIFICATION = 'show-notification',
}

export type JoinRoom = {
    room: string
    user: string
    // Random id per browser (kept across reloads); joining again with the same session takes over the existing user
    session: string
    seed?: boolean
}

/**
 * Full state of a room. The server sends it after every change, so clients never apply deltas.
 *
 * - `id` changes when a room is recreated (e.g., closed and joined again).
 * - `version` increases with every change of the room; clients ignore states older than the one they have.
 * - `votes` is empty while votes are hidden, except for the recipient's own vote in states sent to them directly.
 */
export type RoomState = {
    id: string
    version: number
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

export type RemoveUser = {
    user: string
}

export type User = {
    name: string
    avatar: string
    // Offline users lost their connection but keep their vote until they reconnect or the grace period ends
    online: boolean
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
    [ServerEvents.ROOM_STATE]: (data: RoomState) => void;
    [ServerEvents.CLOSE_ROOM]: () => void;

    [ServerEvents.SHOW_NOTIFICATION]: (data: Notification, ack?: Ack) => void;
}
