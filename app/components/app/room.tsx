import {Button} from "~/components/ui/button"
import {Card, CardContent, CardFooter, CardHeader, CardTitle,} from "~/components/ui/card"
import React from "react";
import {Avatar, AvatarImage} from "~/components/ui/avatar"
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from "~/components/ui/table"
import {CircleArrowLeft, Eye, EyeOff, Trash2} from "lucide-react";
import {toast} from "sonner";
import {ResultContent} from "~/components/app/result";
import Vote from "~/components/app/vote";
import Share from "~/components/app/share";
import Hidden from "~/components/app/hidden";
import {io, Socket} from 'socket.io-client';
import {
    AddUser,
    ClientEvents,
    ClientToServerEvents,
    InitState, RemoveUser,
    ServerEvents,
    ServerToClientEvents, SetVote,
    User, Votes, Notification
} from "~/socket/types";
import Health from "~/components/app/health";

// TODO: remove debug state in JSX (as hidden parameter?)

export function RoomCard(props: {
    room: string,
    user: string,
    setProcess: (process: string) => void;
}) {

    // TODO: correct URL
    const [socket, _] = React.useState<Socket<ServerToClientEvents, ClientToServerEvents>>(() => io('http://localhost:3000', {
        timeout: 2000
    }))

    const [connected, setConnected] = React.useState(false);
    React.useEffect(() => {
        let id: string;
        socket.connect()

        socket.on('connect', () => {
            id = socket.id!
            console.log('socket', id, 'on', 'connect')
            setConnected(true);
            socket.emit(ClientEvents.JOIN_ROOM, {user: props.user, room: props.room});
            toast('Connected ...')
        });

        socket.on('disconnect', (reason) => {
            console.log('socket', id, 'on', 'disconnect', reason)
            setConnected(false);
            toast('Disconnected ...')
        });

        socket.on('connect_error', (error) => {
            console.log('socket', id, 'on', 'connect_error', error)
            toast('Connection error ...')
        });

        socket.on(ServerEvents.INIT_STATE, (data: InitState) => {
            console.log('socket', id, 'on', ServerEvents.INIT_STATE, data)
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
            console.log('socket', id, 'on', ServerEvents.ADD_USER, data)
            setUsers(prev => [...prev, data])
        })

        socket.on(ServerEvents.REMOVE_USER, (data: RemoveUser) => {
            console.log('socket', id, 'on', ServerEvents.REMOVE_USER, data)
            setUsers(prev => prev.filter(it => it.name !== data.user))
            setVotes(prev => {
                delete prev[data.user]
                return {...prev}
            })
        })

        socket.on(ServerEvents.SET_VOTE, (data: SetVote) => {
            console.log('socket', id, 'on', ServerEvents.SET_VOTE, data)
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
        console.log('socket', socket.id, 'emit', ClientEvents.SET_VOTE, data)
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
        socket.disconnect()
        props.setProcess('JOIN')
    }

    function onLocalCloseRoom() {
        console.log('socket', socket.id, 'emit', ClientEvents.CLOSE_ROOM)
        socket.emit(ClientEvents.CLOSE_ROOM)
        onLocalBack()
    }

    React.useEffect(() => {
        const onUnload = () => socket.disconnect()
        window.addEventListener("beforeunload", onUnload)
        return () => window.removeEventListener("beforeunload", onUnload)
    }, [])

    return (
        <div className="flex flex-col gap-6">

            <Health connected={connected}/>

            <Card className="overflow-hidden p-0 shadow-none">
                <div className="grid p-0 md:grid-cols-2">
                    <div className="flex flex-col gap-6">
                        <CardHeader className="flex flex-row justify-between items-center"
                                    style={{marginTop: '-12px', marginBottom: '-10px'}}>

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
                                                <Vote onChange={onVoteChange}/> : votes[user.name] ? hidden ?
                                                    <Hidden/> : votes[user.name] : 'Still voting ...'}</TableCell>
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

                            <Button type="submit" className="w-full" variant="secondary"
                                    onClick={onLocalCloseRoom}>
                                <Trash2/> Close Room
                            </Button>

                            <Button type="submit" className="w-full" onClick={onLocalBack}
                                    variant="secondary">
                                <CircleArrowLeft/> Leave Room
                            </Button>
                        </CardFooter>
                    </div>

                    <div className="flex flex-col gap-6 bg-muted">

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

            {false && <React.Fragment>

                <pre>connected: {JSON.stringify(socket.connected, null, 4)}</pre>
                <pre>hidden: {JSON.stringify(hidden, null, 4)}</pre>
                <pre>{JSON.stringify(users, null, 4)}</pre>
                <pre>{JSON.stringify(votes, null, 4)}</pre>


            </React.Fragment>}

        </div>
    )
}
