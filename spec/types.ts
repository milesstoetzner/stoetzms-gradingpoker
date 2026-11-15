export enum ClientEvents {
    JOIN_ROOM = 'join-room',
    INIT_STATE = 'init-state',

    SET_VOTE = 'set-vote',
    SET_COMMENT = 'set-comment',
    SHOW_VOTES = 'show-votes',
    HIDE_VOTES = 'hide-votes',

    CLOSE_ROOM = 'close-room',
    REMOVE_USER = 'remove-user',

    HEALTH = 'health',
}

export enum ServerEvents {
    // Full room state, sent to a single client when it joins or asks for it, see RoomState
    ROOM_STATE = 'room-state',
    // A change of the room, sent to everyone in it, see RoomEvent
    ROOM_EVENT = 'room-event',
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
 * Full state of a room, as seen by the recipient. Changes afterwards arrive as RoomEvent.
 *
 * - `id` changes when a room is recreated (e.g., closed and joined again).
 * - `version` increases with every change of the room.
 * - `votes` is empty while votes are hidden, except for the recipient's own vote.
 * - `comments` are anonymous: empty while votes are hidden, afterwards all comments sorted alphabetically (never in an
 *   order or shape that reveals who wrote them). `comment` is the recipient's own comment.
 */
export type RoomState = {
    id: string
    version: number
    hidden: boolean
    users: User[]
    votes: Votes
    voted: Voted
    comments: string[]
    comment?: string
}

/**
 * A change of a room. `version` is the version of the room after the change, so a client applies an event only if it
 * is exactly one ahead of its state and asks for the full state if it missed one (see RoomSync).
 *
 * - `joined` and `voted` hide the votes.
 * - `voted` does not include the vote, `shown` includes all votes and comments.
 * - `left` includes the remaining comments while votes are shown, and who removed the user, if someone did.
 * - `shown` and `hidden` include who showed or hid the votes.
 * - `version` is no change but a heartbeat with the current version, for clients which missed the last change.
 */
export type RoomEvent = {id: string; version: number} & (
    | {type: 'joined'; user: string}
    | {type: 'online'; user: string}
    | {type: 'offline'; user: string}
    | {type: 'left'; user: string; by?: string; comments?: string[]}
    | {type: 'voted'; user: string}
    | {type: 'shown'; votes: Votes; comments: string[]; by?: string}
    | {type: 'hidden'; by?: string}
    | {type: 'version'}
)

export type Votes = { [user: string]: string }
export type Voted = { [user: string]: boolean }

export type SetVote = {
    vote: string
}

// Empty comment removes it
export type SetComment = {
    comment: string
}

export const COMMENT_MAX_LENGTH = 500

export type RemoveUser = {
    user: string
}

export type User = {
    name: string
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
    [ClientEvents.SET_COMMENT]: (data: SetComment, ack: Ack) => void;
    [ClientEvents.SHOW_VOTES]: (ack: Ack) => void;
    [ClientEvents.HIDE_VOTES]: (ack: Ack) => void;

    [ClientEvents.HEALTH]: (ack: Ack) => void;
}

export interface ServerToClientEvents {
    [ServerEvents.ROOM_STATE]: (data: RoomState) => void;
    [ServerEvents.ROOM_EVENT]: (data: RoomEvent) => void;
    [ServerEvents.CLOSE_ROOM]: () => void;

    [ServerEvents.SHOW_NOTIFICATION]: (data: Notification, ack?: Ack) => void;
}
