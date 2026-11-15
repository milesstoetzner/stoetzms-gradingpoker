import React from 'react'
import {io, Socket} from 'socket.io-client'
import {toast} from 'sonner'
import {useDebounce} from 'use-debounce'
import {RoomSync} from '../../../spec/sync'
import {
    Ack,
    ClientEvents,
    ClientToServerEvents,
    Notification,
    Response,
    RoomEvent,
    RoomState,
    ServerEvents,
    ServerToClientEvents,
} from '../../../spec/types'
import {getSession} from './session'
import {useOwnComment} from './use-own-comment'
import {useRequests} from './use-requests'

const CONNECT_TIMEOUT_MILLISECONDS = 2000
// Errors only show if they last, e.g., not for a short reconnect
const ERROR_DELAY_MILLISECONDS = 500

const EMPTY_ROOM: Pick<RoomState, 'hidden' | 'users' | 'votes' | 'voted' | 'comments'> = {
    hidden: true,
    users: [],
    votes: {},
    voted: {},
    comments: [],
}

type Options = {
    room: string
    user: string
    // Fill a new room with fake users
    seed: boolean
    debug: boolean
    // Called when the user is out of the room: left, removed, or the room is closed
    onLeft: () => void
}

/**
 * Joins the room and keeps its state up to date: the server sends the full state once and changes as events
 * afterwards. Also holds what only this user knows: the own vote and the draft of the own comment.
 */
export function useRoom({room, user, seed, debug, onLeft}: Options) {
    const [socket] = React.useState<Socket<ServerToClientEvents, ClientToServerEvents>>(() =>
        io(window.location.origin, {
            timeout: CONNECT_TIMEOUT_MILLISECONDS,
            path: '/socket.io',
            // WebSocket only: long-polling would require sticky sessions with multiple backend servers
            transports: ['websocket'],
        })
    )

    const [connected, setConnected] = React.useState(false)
    const [joined, setJoined] = React.useState(false)
    const [error, setError] = useDebounce<string | undefined>(undefined, ERROR_DELAY_MILLISECONDS)

    const sync = React.useRef(new RoomSync())
    const [state, setState] = React.useState<RoomState>()
    const [vote, setVote] = React.useState('')

    const {request, isPending} = useRequests(socket, debug)
    const comment = useOwnComment((value, onSaved) =>
        request('comment', ClientEvents.SET_COMMENT, {comment: value}, onSaved)
    )

    function leave() {
        socket.disconnect()
        onLeft()
    }

    React.useEffect(() => {
        // Whether we were in the room before, i.e., failed connects are attempts to reconnect
        let lostConnection = false
        const log = (...message: unknown[]) => console.log('socket', socket.id, ...message)

        // Asks for the full state, e.g., after a missed event
        const resync = () => {
            log('emit', ClientEvents.INIT_STATE)
            socket.emit(ClientEvents.INIT_STATE, () => {})
        }

        const show = (next: RoomState) => {
            setState(next)

            // Own vote is only known from full states or if votes are shown, otherwise we keep what we voted
            const ownVote = next.votes[user]
            if (ownVote !== undefined) setVote(ownVote)
            else if (!next.voted[user]) setVote('')
        }

        socket.on('connect', () => {
            log('on', 'connect')
            lostConnection = false
            setConnected(true)
            setError(undefined)

            socket.emit(ClientEvents.JOIN_ROOM, {user, room, session: getSession(), seed}, (response: Response) => {
                log('ack', ClientEvents.JOIN_ROOM, response)
                if (response.ok) setJoined(true)
            })
        })

        socket.on('disconnect', reason => {
            log('on', 'disconnect', reason)
            setConnected(false)

            if (reason === 'io server disconnect') return leave()
            lostConnection = true
            setError('Connection lost, reconnecting ...')
        })

        socket.on('connect_error', connectError => {
            log('on', 'connect_error', connectError)
            setError(lostConnection ? 'Connection lost, reconnecting ...' : 'Cannot reach the server, retrying ...')
        })

        socket.on(ServerEvents.ROOM_STATE, (full: RoomState) => {
            log('on', ServerEvents.ROOM_STATE, debug ? full : full.version)

            const outdated = sync.current.snapshot(full)
            if (sync.current.state) show(sync.current.state)

            if (full.comment !== undefined) comment.load(full.comment)

            if (outdated) resync()
        })

        socket.on(ServerEvents.ROOM_EVENT, (event: RoomEvent) => {
            log('on', ServerEvents.ROOM_EVENT, event.type, event.version)

            const result = sync.current.event(event)
            if (result === 'applied' && sync.current.state) show(sync.current.state)
            if (result === 'resync') resync()
        })

        socket.on(ServerEvents.CLOSE_ROOM, () => {
            log('on', ServerEvents.CLOSE_ROOM)
            toast('Room closed ...')
            leave()
        })

        socket.on(ServerEvents.SHOW_NOTIFICATION, (notification: Notification, ack?: Ack) => {
            log('on', ServerEvents.SHOW_NOTIFICATION)
            toast(notification.message)
            if (ack) ack({ok: true})
        })

        socket.connect()

        return () => {
            socket.removeAllListeners()
            socket.disconnect()
        }
        // The socket lives as long as the component, and room and user never change while in the room
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket])

    // Closing or reloading the tab only drops the connection (the user stays offline with their vote and is taken
    // over on reload). When a backgrounded tab (e.g., mobile) becomes visible again, reconnect right away.
    React.useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible' && !socket.connected && joined) socket.connect()
        }
        document.addEventListener('visibilitychange', onVisible)
        return () => document.removeEventListener('visibilitychange', onVisible)
    }, [joined, socket])

    return {
        socket,
        connected,
        joined,
        error,
        ...(state ?? EMPTY_ROOM),
        vote,
        comment: comment.value,
        commentSaved: comment.saved,
        isPending,
        leave,

        setVote(value: string) {
            // Voting hides votes on the server, the event follows
            setVote(value)
            request('vote', ClientEvents.SET_VOTE, {vote: value})
        },

        setComment: comment.change,

        showVotes() {
            // Do not lose a comment typed right before revealing
            comment.flush()
            request('show', ClientEvents.SHOW_VOTES)
        },

        hideVotes: () => request('hide', ClientEvents.HIDE_VOTES),

        removeUser: (name: string) => request('remove', ClientEvents.REMOVE_USER, {user: name}),

        // The server answers with close room to everyone (including us) instead of an ack
        closeRoom: () => request('close', ClientEvents.CLOSE_ROOM),

        refresh: () => request('refresh', ClientEvents.INIT_STATE, undefined, () => toast('Refreshed ...')),
    }
}

export type Room = ReturnType<typeof useRoom>
