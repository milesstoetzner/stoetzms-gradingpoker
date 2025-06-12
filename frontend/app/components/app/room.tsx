import {Button} from "../ui/button"
import {Card, CardContent, CardFooter, CardHeader, CardTitle,} from "../ui/card"
import React, {useDebugValue, useEffect, useRef, useState} from "react";
import {Avatar, AvatarImage} from "../ui/avatar"
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from "../ui/table"
import {CircleArrowLeft, Eye, EyeOff, Trash2} from "lucide-react";
import {toast} from "sonner";
import {ResultContent} from "./result";
import Ballot from "./ballot";
import Share from "./share";
import Hidden from "./hidden";
import {io, Socket} from 'socket.io-client';
import {
    AddUser,
    ClientEvents,
    ClientToServerEvents,
    InitState, RemoveUser,
    ServerEvents,
    ServerToClientEvents, SetVote,
    User, Votes, Notification
} from "../../../../spec/types";
import Error from "./error";
import {useLocation, useNavigationType, useSearchParams} from "@remix-run/react";
import {useDebounce} from 'use-debounce';
import Vote from "./vote";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../ui/dialog"

export function RoomCard(props: {
    room: string,
    user: string,
    setProcess: (process: string) => void;
}) {

    const [searchParams, _] = useSearchParams();
    const debug = searchParams.has('debug')
    const dev = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined

    const [socket, __] = React.useState<Socket<ServerToClientEvents, ClientToServerEvents>>(() => io(window.location.origin, {
        timeout: 2000,
        path: "/socket.io",
    }))

    const [immediateError, setImmediateError] = React.useState<string>();
    const [debouncedError, setDebouncedError] = useDebounce<string | undefined>('', 500)

    React.useEffect(() => {
        let id: string;
        socket.connect()

        socket.on('connect', () => {
            id = socket.id!
            console.log('socket', id, 'on', 'connect')
            setImmediateError(undefined);
            setDebouncedError(undefined);
            socket.emit(ClientEvents.JOIN_ROOM, {user: props.user, room: props.room, seed: searchParams.has('seed')});
        });

        socket.on(ServerEvents.RECONNECT, () => {
            console.log('socket', id, 'on', 'reconnect',)
            setImmediateError(undefined);
            setDebouncedError(undefined);
        });

        socket.on('disconnect', (reason) => {
            console.log('socket', id, 'on', 'disconnect', reason)

            if (reason === "io server disconnect") {
                setImmediateError('The server closed the connection ... will not reconnect ...')
            } else {
                setDebouncedError('No connection ...')
            }
        });

        socket.on('connect_error', (error) => {
            console.log('socket', id, 'on', 'connect_error', error)
            setImmediateError('Connection error ...')
        });

        socket.on(ServerEvents.INIT_STATE, (data: InitState) => {
            console.log('socket', id, 'on', ServerEvents.INIT_STATE, debug ? data : undefined)
            setUsers(data.users);
            setVotes(data.votes);
            setHidden(data.hidden);
        });

        socket.on(ServerEvents.CLOSE_ROOM, () => {
            console.log('socket', id, 'on', ServerEvents.CLOSE_ROOM)
            toast('Room closed ...')
            onLocalBack()
        });

        socket.on(ServerEvents.ADD_USER, (data: AddUser) => {
            console.log('socket', id, 'on', ServerEvents.ADD_USER, debug ? data : undefined)
            setUsers(prev => [...prev, data])
        })

        socket.on(ServerEvents.REMOVE_USER, (data: RemoveUser) => {
            console.log('socket', id, 'on', ServerEvents.REMOVE_USER, debug ? data : undefined)
            setUsers(prev => prev.filter(it => it.name !== data.user))
            setVotes(prev => {
                delete prev[data.user]
                return {...prev}
            })
        })

        socket.on(ServerEvents.SET_VOTE, (data: SetVote) => {
            console.log('socket', id, 'on', ServerEvents.SET_VOTE, debug ? data : undefined)
            setVotes(prev => {
                prev[data.user] = data.vote
                return {...prev}
            })
        });

        socket.on(ServerEvents.SHOW_VOTES, () => {
            console.log('socket', id, 'on', ServerEvents.SHOW_VOTES)
            setHidden(false)
        });


        socket.on(ServerEvents.HIDE_VOTES, () => {
            console.log('socket', id, 'on', ServerEvents.HIDE_VOTES)
            setHidden(true)
        });

        socket.on(ServerEvents.SHOW_NOTIFICATION, (data: Notification) => {
            console.log('socket', id, 'on', ServerEvents.SHOW_NOTIFICATION)
            toast(data.message)
        })

        return () => {
            socket.removeAllListeners()
            socket.disconnect()
        };
    }, [socket]);


    const [hidden, setHidden] = React.useState<boolean>(true);
    const [users, setUsers] = React.useState<User[]>([]);
    const [votes, setVotes] = React.useState<Votes>({});

    function onVoteChange(vote: string) {
        onLocalHideVotes()

        const data = {vote}
        console.log('socket', socket.id, 'emit', ClientEvents.SET_VOTE, debug ? data : undefined)
        socket.emit(ClientEvents.SET_VOTE, data)

        setVotes({...votes, [props.user]: vote})
    }

    function onLocalShowVotes() {
        setHidden(false)
        console.log('socket', socket.id, 'emit', ClientEvents.SHOW_VOTES)
        socket.emit(ClientEvents.SHOW_VOTES)
    }

    function onLocalHideVotes() {
        setHidden(true)
        console.log('socket', socket.id, 'emit', ClientEvents.HIDE_VOTES)
        socket.emit(ClientEvents.HIDE_VOTES)
    }

    function onLocalBack() {
        if (socket) socket.disconnect()
        props.setProcess('JOIN')
    }

    function onLocalCloseRoom() {
        console.log('socket', socket.id, 'emit', ClientEvents.CLOSE_ROOM)
        socket.emit(ClientEvents.CLOSE_ROOM, () => {
            console.log('socket', socket.id, 'ack', ClientEvents.CLOSE_ROOM)
            toast('Room closed ...')
            onLocalBack()
        })
    }

    useEffect(() => {
        const onUnload = () => socket.disconnect()
        window.addEventListener("beforeunload", onUnload)
        return () => window.removeEventListener("beforeunload", onUnload)
    }, [])

    const location = useLocation();
    const navigationType = useNavigationType();
    const [render, setRender] = useState(0);

    useEffect(() => {
        // Strict mode results in two renders in dev mode
        if (render < (dev ? 2: 1)) {
            console.log('render', render)
            return setRender(prev => prev + 1)
        }

        if (navigationType === 'POP') {
            console.log('browser', 'back')
            onLocalBack()
        }
    }, [location]);

    return (
        <div className="flex flex-col gap-6">

            <Error error={immediateError}/>

            <Error error={debouncedError}/>

            <Card className="overflow-hidden p-0 shadow-none">
                <div className="grid p-0 md:grid-cols-2">
                    <div className="flex flex-col gap-6">
                        <CardHeader className="flex flex-row justify-between items-center" style={{marginTop: '-12px', marginBottom: '-10px'}}>

                            <CardTitle>{props.room}</CardTitle>

                            <Share/>
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
                                    {users.map((user) => (
                                        <TableRow key={user.name}>
                                            <TableCell>
                                                <Avatar style={{borderWidth: '1px'}}>
                                                    <AvatarImage
                                                        src={`data:image/svg+xml;base64,${btoa(user.avatar)}`}></AvatarImage>
                                                </Avatar>
                                            </TableCell>
                                            <TableCell>{user.name}</TableCell>
                                            <TableCell>{user.name === props.user ?
                                                <Ballot onChange={onVoteChange}/> : votes[user.name] ? hidden ?
                                                    <Hidden/> : <Vote vote={votes[user.name]} /> : 'Still voting ...'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                        </CardContent>

                        <CardFooter className="flex-col gap-2">
                            <Button type="submit" className="w-full" onClick={onLocalShowVotes}
                                    disabled={!Object.values(votes).length}>
                                <Eye/> Show Votes
                            </Button>

                            <Button type="submit" className="w-full" variant="secondary"
                                    onClick={onLocalHideVotes}>
                                <EyeOff/> Hide Votes
                            </Button>

                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button type="submit" className="w-full" variant="secondary">
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
                                        <Button type="submit" onClick={onLocalCloseRoom}>Yes</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>



                            <Button type="submit" className="w-full" onClick={onLocalBack}
                                    variant="secondary">
                                <CircleArrowLeft/> Leave Room
                            </Button>
                        </CardFooter>
                    </div>

                    <div className="flex flex-col gap-6 bg-muted min-h-[200px]">

                        {hidden ? <div className="h-full flex items-center justify-center">
                                <p className="text-sm text-center">
                                    Still voting ...
                                </p>
                            </div> :

                            <ResultContent votes={votes}/>

                        }

                    </div>
                </div>

            </Card>

            <br/>
            <br/>
            <br/>

            {debug && <React.Fragment>

                <pre>{JSON.stringify({
                    debug,
                    connected: socket.connected,
                    hidden,
                    users,
                    votes
                }, null, 4)}</pre>

            </React.Fragment>}

        </div>
    )
}
