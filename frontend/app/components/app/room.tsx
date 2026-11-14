import {Button} from '../ui/button'
import {Card, CardContent, CardFooter, CardHeader, CardTitle} from '../ui/card'
import React, {useEffect, useState} from 'react'
import {Avatar, AvatarImage} from '../ui/avatar'
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '../ui/table'
import {CircleArrowLeft, Eye, EyeOff, Presentation, RefreshCw, Trash2} from 'lucide-react'
import {toast} from 'sonner'
import {ResultContent} from './result'
import Ballot from './ballot'
import Share from './share'
import Hidden from './hidden'
import {io, Socket} from 'socket.io-client'
import {
    ClientEvents,
    ClientToServerEvents,
    RoomState,
    ServerEvents,
    ServerToClientEvents,
    User,
    Votes,
    Notification,
    Response,
    HIDDEN, Ack, Voted,
} from '../../../../spec/types'
import Error from './error'
import {useLocation, useNavigationType, useSearchParams} from '@remix-run/react'
import {useDebounce} from 'use-debounce'
import Vote from './vote'
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../ui/dialog'
import {Badge} from "../ui/badge";
import Hover from "./hover";
import Kick from "./kick";
import {getSession} from '../../lib/session'
import {findDiscussion} from '../../lib/discussion'

export function RoomCard(props: { room: string; user: string; setProcess: (process: string) => void }) {
    const [searchParams, _] = useSearchParams()
    const debug = searchParams.has('debug')
    const dev = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined

    const [socket, __] = React.useState<Socket<ServerToClientEvents, ClientToServerEvents>>(() =>
        io(window.location.origin, {
            timeout: 2000,
            path: '/socket.io',
            // WebSocket only: long-polling would require sticky sessions with multiple backend servers
            transports: ['websocket'],
        })
    )

    const [connected, setConnected] = useState(false)
    const [joined, setJoined] = useState(false)
    const [error, setError] = useDebounce<string | undefined>(undefined, 500)

    // Latest applied room state, older states (e.g., delayed broadcasts) are ignored
    const latest = React.useRef<{id: string; version: number}>()

    React.useEffect(() => {
        let id: string
        // Whether we were in the room before, i.e., failed connects are attempts to reconnect
        let lost = false
        socket.connect()

        socket.on('connect', () => {
            id = socket.id!
            console.log('socket', id, 'on', 'connect')
            lost = false
            setConnected(true)
            setError(undefined)

            socket.emit(ClientEvents.JOIN_ROOM, {
                user: props.user,
                room: props.room,
                session: getSession(),
                seed: searchParams.has('seed')
            }, (data: Response) => {
                console.log('socket', socket.id, 'ack', ClientEvents.JOIN_ROOM, data)
                if (!data.ok) return
                setJoined(true)
            })
        })

        socket.on('disconnect', reason => {
            console.log('socket', id, 'on', 'disconnect', reason)
            setConnected(false)

            if (reason === 'io server disconnect') {
                onLocalBack()
            } else {
                lost = true
                setError('Connection lost, reconnecting ...')
            }
        })

        socket.on('connect_error', error => {
            console.log('socket', id, 'on', 'connect_error', error)
            setError(lost ? 'Connection lost, reconnecting ...' : 'Cannot reach the server, retrying ...')
        })

        socket.on(ServerEvents.ROOM_STATE, (data: RoomState) => {
            console.log('socket', id, 'on', ServerEvents.ROOM_STATE, debug ? data : data.version)

            const current = latest.current
            if (current && current.id === data.id && current.version > data.version) return
            latest.current = {id: data.id, version: data.version}

            setUsers(data.users)
            setVotes(data.votes)
            setVoted(data.voted)
            setHidden(data.hidden)

            // Own vote is only included in states sent directly to us (or if votes are shown)
            const own = data.votes[props.user]
            if (own !== undefined) setVote(own)
            else if (!data.voted[props.user]) setVote('')
        })

        socket.on(ServerEvents.CLOSE_ROOM, () => {
            console.log('socket', id, 'on', ServerEvents.CLOSE_ROOM)
            toast('Room closed ...')
            onLocalBack()
        })

        socket.on(ServerEvents.SHOW_NOTIFICATION, (data: Notification, ack?: Ack) => {
            console.log('socket', id, 'on', ServerEvents.SHOW_NOTIFICATION)
            toast(data.message)
            if (ack) ack({ok: true})
        })

        return () => {
            socket.removeAllListeners()
            socket.disconnect()
        }
    }, [socket])

    const [hidden, setHidden] = React.useState<boolean>(true)
    const [users, setUsers] = React.useState<User[]>([])
    const [votes, setVotes] = React.useState<Votes>({})
    const [voted, setVoted] = React.useState<Voted>({})
    const [vote, setVote] = React.useState<string>('')
    const [presentation, setPresentation] = React.useState<boolean>(false)

    // Users with the most opposite votes, who should discuss (once votes are shown)
    const discussion = hidden ? undefined : findDiscussion(votes)
    const discusses = (user: string) =>
        !!discussion && (discussion.low.users.includes(user) || discussion.high.users.includes(user))

    // Requests waiting for their ack, to prevent double submits
    const [pending, setPending] = React.useState<Set<string>>(new Set())
    const isPending = (key: string) => pending.has(key)

    function request(key: string, event: ClientEvents, data?: unknown, onAck?: (response: Response) => void) {
        console.log('socket', socket.id, 'emit', event, debug ? data : HIDDEN)
        setPending(prev => new Set(prev).add(key))

        const done = (error: Error | null, response?: Response) => {
            console.log('socket', socket.id, 'ack', event, error ? error.message : response)
            setPending(prev => {
                const next = new Set(prev)
                next.delete(key)
                return next
            })
            if (response && onAck) onAck(response)
        }

        // Rate limited or failed requests are never acked, hence, the timeout
        const emitter = socket.timeout(5000) as any
        if (data === undefined) emitter.emit(event, done)
        else emitter.emit(event, data, done)
    }

    function onVoteChange(vote: string) {
        // Voting hides votes on the server, the room state follows
        setVote(vote)

        request('vote', ClientEvents.SET_VOTE, {vote})
    }

    function onLocalShowVotes() {
        request('show', ClientEvents.SHOW_VOTES)
    }

    function onLocalHideVotes() {
        request('hide', ClientEvents.HIDE_VOTES)
    }

    function onLocalBack() {
        if (socket) socket.disconnect()
        props.setProcess('JOIN')
    }

    function onLocalCloseRoom() {
        // The server answers with close room to everyone (including us) instead of an ack
        request('close', ClientEvents.CLOSE_ROOM)
    }

    function onRemoveUser(user: string) {
        request('remove', ClientEvents.REMOVE_USER, {user})
    }

    function onRefresh() {
        request('refresh', ClientEvents.INIT_STATE, undefined, () => toast('Refreshed ...'))
    }

    // Closing or reloading the tab only drops the connection (the user stays offline with their vote and is taken
    // over on reload). When a backgrounded tab (e.g., mobile) becomes visible again, reconnect right away.
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible' && !socket.connected && joined) socket.connect()
        }
        document.addEventListener('visibilitychange', onVisible)
        return () => document.removeEventListener('visibilitychange', onVisible)
    }, [joined])

    const location = useLocation()
    const navigationType = useNavigationType()
    const [render, setRender] = useState(0)

    useEffect(() => {
        // Strict mode results in two renders in dev mode
        if (render < (dev ? 2 : 1)) {
            console.log('render', render)
            return setRender(prev => prev + 1)
        }

        if (navigationType === 'POP') {
            console.log('browser', 'back')
            onLocalBack()
        }
    }, [location])

    return (
        <div className="flex flex-col gap-6">

            <Error error={error}/>

            {!joined && <JoiningCard room={props.room}/>}

            {joined && <Card className="overflow-hidden p-0 shadow-none animate-in fade-in duration-300">
                <div className="grid grid-cols-1 p-0 lg:grid-cols-2 lg:grid-rows-[1fr_auto]">
                    <div className="flex min-w-0 flex-col gap-2 lg:col-start-1 lg:row-start-1 lg:gap-6">
                        <CardHeader
                            className="flex flex-row items-center justify-between gap-2 px-4 sm:px-6"
                            style={{marginTop: '-12px', marginBottom: '-10px'}}
                        >
                            <CardTitle className="min-w-0 truncate leading-normal" title={props.room}>{props.room}</CardTitle>

                            <span className="ml-auto flex shrink-0 items-center gap-2">
                                <Hover message="Presentation Mode">
                                <Button variant={presentation ? "default" : "outline"} className="size-8" onClick={() => setPresentation(prev => !prev)}>
                                    <Presentation size="icon"/>
                                </Button>
                                </Hover>


                                <Hover message="Refresh Room">
                                <Button variant="outline" className="size-8" onClick={onRefresh} disabled={!connected || isPending('refresh')}>
                                    <RefreshCw size="icon"/>
                                </Button>
                                </Hover>

                                <Share/>
                            </span>

                        </CardHeader>

                        <CardContent className="px-4 sm:px-6 lg:min-h-[450px]">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[0px] px-1 sm:px-2">User</TableHead>
                                        <TableHead className="px-1 sm:px-2"></TableHead>
                                        <TableHead className="w-[45%] px-1 sm:w-[125px] sm:px-2">Vote</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map(user => (
                                        <TableRow key={user.name} className="animate-in fade-in duration-300">
                                            <TableCell className="px-1 sm:px-2">
                                                <Avatar style={{borderWidth: '1px'}} className={user.online ? '' : 'opacity-40'}>
                                                    <AvatarImage
                                                        src={`data:image/svg+xml;base64,${btoa(user.avatar)}`}
                                                    ></AvatarImage>
                                                </Avatar>
                                            </TableCell>
                                            <TableCell className="break-words px-1 sm:px-2">{user.name} {user.name === props.user && !presentation &&
                                                <Badge className="ml-[0.5rem]">me</Badge>}
                                                {discusses(user.name) && (
                                                    <Hover message="Most opposite vote, please discuss">
                                                        <span className="ml-[0.5rem] inline-flex animate-in fade-in">
                                                            <Badge variant="outline" className="border-amber-500 text-amber-700">discuss</Badge>
                                                        </span>
                                                    </Hover>
                                                )}
                                                {!user.online && (
                                                    <Hover message="Lost connection, keeps their vote for a while">
                                                        <span className="ml-[0.5rem] inline-flex">
                                                            <Badge variant="outline" className="text-muted-foreground">offline</Badge>
                                                        </span>
                                                    </Hover>
                                                )}
                                            </TableCell>
                                            <TableCell className="px-1 sm:px-2">
                                                {user.name === props.user && !presentation ? (
                                                    <Ballot value={vote} onChange={onVoteChange} disabled={!connected}/>
                                                ) : voted[user.name] ? (
                                                    hidden ? (
                                                        <Hidden/>
                                                    ) : (
                                                        <span className="block animate-in fade-in zoom-in-95 duration-300">
                                                            <Vote vote={votes[user.name]}/>
                                                        </span>
                                                    )
                                                ) : (
                                                    'Still voting ...'
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>

                    </div>

                    <div className="flex min-w-0 flex-col gap-6 bg-muted lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:min-h-[200px]">
                        {hidden ? (
                            <div className="hidden h-full items-center justify-center lg:flex">
                                <p className="text-sm text-center">Still voting ...</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 pb-4 duration-500 lg:pb-0">
                                <ResultContent room={props.room} votes={votes} users={users} discussion={discussion}/>
                            </div>
                        )}
                    </div>

                    <div className="min-w-0 pb-4 lg:col-start-1 lg:row-start-2 lg:pb-0">
                        <CardFooter className="grid grid-cols-2 gap-2 px-4 pt-4 sm:px-6 lg:pt-0">
                            <Button
                                type="submit"
                                className="w-full"
                                onClick={onLocalShowVotes}
                                disabled={!Object.values(voted).length || !connected || isPending('show')}
                            >
                                <Eye/> Show Votes
                            </Button>

                            <Button type="submit" className="w-full" variant="secondary" onClick={onLocalHideVotes}
                                    disabled={!connected || isPending('hide')}>
                                <EyeOff/> Hide Votes
                            </Button>

                            <div className="col-span-2 grid grid-cols-3 gap-2">
                            <Kick users={users} me={props.user} onClick={onRemoveUser} disabled={!connected}
                                  pending={isPending('remove')}/>

                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button type="submit" className="w-full" variant="secondary" disabled={!connected}>
                                        <Trash2/> <span>Close<span className="hidden sm:inline"> Room</span></span>
                                    </Button>
                                </DialogTrigger>

                                <DialogContent className="sm:max-w-[425px]">
                                    <DialogHeader>
                                        <DialogTitle>Close Room</DialogTitle>
                                        <DialogDescription>
                                            Do you really want to the close the room and reset its state?
                                        </DialogDescription>
                                    </DialogHeader>

                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button variant="outline">No</Button>
                                        </DialogClose>
                                        <Button type="submit" onClick={onLocalCloseRoom} disabled={isPending('close')}>
                                            Yes
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            <Button type="submit" className="w-full" onClick={onLocalBack} variant="secondary"
                                    disabled={!connected}>
                                <CircleArrowLeft/> <span>Leave<span className="hidden sm:inline"> Room</span></span>
                            </Button>
                            </div>
                        </CardFooter>
                    </div>
                </div>
            </Card>

            }

            {debug && (
                <React.Fragment>

                    <br/>
                    <br/>
                    <br/>

                    <Button type="submit" className="w-full" onClick={() => {
                        socket.connect()
                    }} variant="secondary">
                        Socket Connect
                    </Button>

                    <Button type="submit" className="w-full" onClick={() => {
                        socket.disconnect()
                    }} variant="secondary">
                        Socket Disconnect
                    </Button>


                    <pre>
                        {JSON.stringify(
                            {
                                debug,
                                connected,
                                vote,
                                hidden,
                                users,
                                votes,
                                voted
                            },
                            null,
                            4
                        )}
                    </pre>
                </React.Fragment>
            )}
        </div>
    )
}

// Shown while connecting and joining the room
function JoiningCard(props: {room: string}) {
    return (
        <Card className="p-6 shadow-none">
            <p className="text-sm text-center">Joining {props.room} ...</p>
        </Card>
    )
}
