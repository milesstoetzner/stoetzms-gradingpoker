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

export function RoomCard(props: { room: string; user: string; setProcess: (process: string) => void }) {
    const [searchParams, _] = useSearchParams()
    const debug = searchParams.has('debug')
    const dev = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined

    const [socket, __] = React.useState<Socket<ServerToClientEvents, ClientToServerEvents>>(() =>
        io(window.location.origin, {
            timeout: 2000,
            path: '/socket.io',
        })
    )

    const [connected, setConnected] = useState(false)
    const [joined, setJoined] = useState(false)
    const [error, setError] = useDebounce<string | undefined>(undefined, 500)

    // Latest applied room state, older states (e.g., delayed broadcasts) are ignored
    const latest = React.useRef<{id: string; version: number}>()

    React.useEffect(() => {
        let id: string
        socket.connect()

        socket.on('connect', () => {
            id = socket.id!
            console.log('socket', id, 'on', 'connect')
            setConnected(true)
            setError(undefined)

            socket.emit(ClientEvents.JOIN_ROOM, {
                user: props.user,
                room: props.room,
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
                setError('No connection ...')
            }
        })

        socket.on('connect_error', error => {
            console.log('socket', id, 'on', 'connect_error', error)
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

    function onVoteChange(vote: string) {
        // Voting hides votes on the server, the room state follows
        setVote(vote)

        const data = {vote}
        console.log('socket', socket.id, 'emit', ClientEvents.SET_VOTE, debug ? data : HIDDEN)
        socket.emit(ClientEvents.SET_VOTE, data, (data: Response) => {
            console.log('socket', socket.id, 'ack', ClientEvents.SET_VOTE, data)
        })
    }

    function onLocalShowVotes() {
        console.log('socket', socket.id, 'emit', ClientEvents.SHOW_VOTES)
        socket.emit(ClientEvents.SHOW_VOTES, (data: Response) => {
            console.log('socket', socket.id, 'ack', ClientEvents.SHOW_VOTES, data)
        })
    }

    function onLocalHideVotes() {
        console.log('socket', socket.id, 'emit', ClientEvents.HIDE_VOTES)
        socket.emit(ClientEvents.HIDE_VOTES, (data: Response) => {
            console.log('socket', socket.id, 'ack', ClientEvents.HIDE_VOTES, data)
        })
    }

    function onLocalBack() {
        if (socket) socket.disconnect()
        props.setProcess('JOIN')
    }

    function onLocalCloseRoom() {
        console.log('socket', socket.id, 'emit', ClientEvents.CLOSE_ROOM)
        // The server answers with close room to everyone (including us) instead of an ack
        socket.emit(ClientEvents.CLOSE_ROOM, () => {})
    }

    function onRemoveUser(user: string) {
        console.log('socket', socket.id, 'emit', ClientEvents.REMOVE_USER)
        socket.emit(ClientEvents.REMOVE_USER, {user}, (data: Response) => {
            console.log('socket', socket.id, 'ack', ClientEvents.REMOVE_USER, data)
        })
    }

    function onRefresh() {
        console.log('socket', socket.id, 'on', ClientEvents.INIT_STATE)
        socket.emit(ClientEvents.INIT_STATE, (data: Response) => {
            console.log('socket', socket.id, 'ack', ClientEvents.INIT_STATE, data)
            toast('Refreshed ...')
        })
    }

    useEffect(() => {
        const onUnload = () => socket.disconnect()
        window.addEventListener('beforeunload', onUnload)
        return () => window.removeEventListener('beforeunload', onUnload)
    }, [])

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

            {joined && <Card className="overflow-hidden p-0 shadow-none">
                <div className="grid p-0 md:grid-cols-2">
                    <div className="flex flex-col gap-6">
                        <CardHeader
                            className="flex flex-row justify-between items-center"
                            style={{marginTop: '-12px', marginBottom: '-10px'}}
                        >
                            <CardTitle>{props.room}</CardTitle>

                            <span className="flex items-center gap-2 ml-auto">
                                <Hover message="Presentation Mode">
                                <Button variant={presentation ? "default" : "outline"} className="size-8" onClick={() => setPresentation(prev => !prev)}>
                                    <Presentation size="icon"/>
                                </Button>
                                </Hover>


                                <Hover message="Refresh Room">
                                <Button variant="outline" className="size-8" onClick={onRefresh}>
                                    <RefreshCw size="icon"/>
                                </Button>
                                </Hover>

                                <Share/>
                            </span>

                        </CardHeader>

                        <CardContent className="min-h-[450px]">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[0px]">User</TableHead>
                                        <TableHead></TableHead>
                                        <TableHead className="w-[125px]">Vote</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map(user => (
                                        <TableRow key={user.name}>
                                            <TableCell>
                                                <Avatar style={{borderWidth: '1px'}}>
                                                    <AvatarImage
                                                        src={`data:image/svg+xml;base64,${btoa(user.avatar)}`}
                                                    ></AvatarImage>
                                                </Avatar>
                                            </TableCell>
                                            <TableCell>{user.name} {user.name === props.user && !presentation &&
                                                <Badge className="ml-[0.5rem]">me</Badge>}  </TableCell>
                                            <TableCell>
                                                {user.name === props.user && !presentation ? (
                                                    <Ballot value={vote} onChange={onVoteChange} disabled={!connected}/>
                                                ) : voted[user.name] ? (
                                                    hidden ? (
                                                        <Hidden/>
                                                    ) : (
                                                        <Vote vote={votes[user.name]}/>
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

                        <CardFooter className="flex-col gap-2">
                            <Button
                                type="submit"
                                className="w-full"
                                onClick={onLocalShowVotes}
                                disabled={!Object.values(voted).length || !connected}
                            >
                                <Eye/> Show Votes
                            </Button>

                            <Button type="submit" className="w-full" variant="secondary" onClick={onLocalHideVotes}
                                    disabled={!connected}>
                                <EyeOff/> Hide Votes
                            </Button>

                            <Kick users={users} me={props.user} onClick={onRemoveUser} disabled={!connected}/>

                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button type="submit" className="w-full" variant="secondary" disabled={!connected}>
                                        <Trash2/> Close Room
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
                                        <Button type="submit" onClick={onLocalCloseRoom}>
                                            Yes
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            <Button type="submit" className="w-full" onClick={onLocalBack} variant="secondary"
                                    disabled={!connected}>
                                <CircleArrowLeft/> Leave Room
                            </Button>
                        </CardFooter>
                    </div>

                    <div className="flex flex-col gap-6 bg-muted min-h-[200px]">
                        {hidden ? (
                            <div className="h-full flex items-center justify-center">
                                <p className="text-sm text-center">Still voting ...</p>
                            </div>
                        ) : (
                            <ResultContent room={props.room} votes={votes} users={users}/>
                        )}
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
