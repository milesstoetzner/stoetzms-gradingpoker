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
    User, Votes
} from "~/socket/types";

// TODO: remove debug state in JSX

// TODO: where to handle this socket connection?!
// TODO: correct URL
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io('http://localhost:3000', {
    autoConnect: true
});

// TODO: error handler, https://socket.io/docs/v4/listening-to-events/#error-handling

export function RoomCard(props: {
    room: string,
    user: string,
    setProcess: (process: string) => void;
}) {

    const [connected, setConnected] = React.useState(socket.connected);
    React.useEffect(() => {

        let id: string;
        socket.connect()

        function onSocketConnect() {
            id = socket.id!
            console.log('socket', id, 'on', 'connect')
            setConnected(true);
            socket.emit(ClientEvents.JOIN_ROOM, {user: props.user, room: props.room});
        }

        function onSocketDisconnect() {
            console.log('socket', id, 'on', 'disconnect')
            setConnected(false);
        }

        function onSocketInitState(data: InitState) {
            console.log('socket', id, 'on', ServerEvents.INIT_STATE, data)
            setUsers(data.users);
            setVotes(data.votes);
            setHidden(data.hidden);
        }

        function onSocketCloseRoom() {
            console.log('socket', id, 'on', ServerEvents.CLOSE_ROOM)
            toast('Room closed ...')
            onLocalBack()
        }

        function onSocketShowVotes() {
            console.log('socket', id, 'on', ServerEvents.SHOW_VOTES)
            setHidden(false)
        }

        function onSocketHideVotes() {
            console.log('socket', id, 'on', ServerEvents.HIDE_VOTES)
            setHidden(true)
        }

        function onSocketAddUser(data: AddUser) {
            console.log('socket', id, 'on', ServerEvents.ADD_USER, data)
            setUsers(prev => [...prev, data])
        }

        function onSocketRemoveUser(data: RemoveUser) {
            console.log('socket', id, 'on', ServerEvents.REMOVE_USER, data)
            setUsers(prev => prev.filter(it => it.name !== data.user))
            setVotes(prev => {
                delete prev[data.user]
                return {...prev}
            })
        }

        function onSocketSetVote(data: SetVote) {
            console.log('socket', id, 'on', ServerEvents.SET_VOTE, data)
            setVotes(prev => {
                prev[data.user] = data.vote
                return {...prev}
            })
        }

        socket.on('connect', onSocketConnect);
        socket.on('disconnect', onSocketDisconnect);

        // TODO: on errors, https://socket.io/docs/v4/emit-cheatsheet/

        socket.on(ServerEvents.INIT_STATE, onSocketInitState);
        socket.on(ServerEvents.CLOSE_ROOM, onSocketCloseRoom);
        socket.on(ServerEvents.ADD_USER, onSocketAddUser);
        socket.on(ServerEvents.REMOVE_USER, onSocketRemoveUser);
        socket.on(ServerEvents.SET_VOTE, onSocketSetVote);
        socket.on(ServerEvents.SHOW_VOTES, onSocketShowVotes);
        socket.on(ServerEvents.HIDE_VOTES, onSocketHideVotes);

        return () => {
            socket.off('connect', onSocketConnect)
            socket.off('disconnect', onSocketDisconnect)

            socket.off(ServerEvents.INIT_STATE, onSocketInitState);
            socket.off(ServerEvents.CLOSE_ROOM, onSocketCloseRoom);
            socket.off(ServerEvents.ADD_USER, onSocketAddUser);
            socket.off(ServerEvents.REMOVE_USER, onSocketRemoveUser);
            socket.off(ServerEvents.SET_VOTE, onSocketSetVote);
            socket.off(ServerEvents.SHOW_VOTES, onSocketShowVotes);
            socket.off(ServerEvents.HIDE_VOTES, onSocketHideVotes);

            socket.disconnect()
        };
    }, []);


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
            <Card className="overflow-hidden p-0">
                <div className="grid p-0 md:grid-cols-2">
                    <div className="flex flex-col gap-6">
                        <CardHeader className="flex flex-row justify-between items-center"
                                    style={{marginTop: '-12px', marginBottom: '-10px'}}>
                            <CardTitle>{props.room}</CardTitle>


                            <Share/>
                        </CardHeader>

                        <CardContent className="min-h-[450px]">
                            Connected: {connected ? 'Yes' : 'No'}


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

            <pre>connected: {JSON.stringify(socket.connected, null, 4)}</pre>
            <pre>hidden: {JSON.stringify(hidden, null, 4)}</pre>
            <pre>{JSON.stringify(users, null, 4)}</pre>
            <pre>{JSON.stringify(votes, null, 4)}</pre>

        </div>
    )
}
