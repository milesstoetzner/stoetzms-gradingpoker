import {Button} from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import React from "react";
import {Avatar, AvatarImage} from "~/components/ui/avatar"
import * as avatar from "@fractalsoftware/random-avatar-generator";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table"
import {CircleArrowLeft, Eye, EyeOff, Trash2} from "lucide-react";
import {toast} from "sonner";
import {ResultContent} from "~/components/app/result";
import Vote from "~/components/app/vote";
import Share from "~/components/app/share";
import Hidden from "~/components/app/hidden";
import {io, Socket} from 'socket.io-client';

// TODO: publish and listen on "join" (when joining, new client needs current state)

// TODO: publish and listen on "disconnect"

// TODO: remove internal state

export type User = {
    name: string
    vote?: string
    avatar: string
}


export function RoomCard(props: {
    room: string,
    user: string,
    setProcess: (process: string) => void;
}) {

    // TODO: where to handle this socket connection?!

    // TODO: join room
    const socket = io(window.location.href, {
        autoConnect: false
    });

    const [connected, setConnected] = React.useState(socket.connected);
    React.useEffect(() => {
        function onSocketConnect(socket: Socket) {
            socket.join(props.room);

            setConnected(true);
        }

        function onSocketDisconnect() {
            setConnected(false);
        }

        function onSocketSetUsers() {
            // TODO. set users
        }

        function onSocketAddUser() {
            // TODO: add user
        }

        function onSocketRemoveUser() {
            // TODO: remove user
        }

        function onSocketSetVote() {
            // TODO: set vote
        }

        function onSocketShowVotes() {
            setHidden(false)
        }

        function onSocketHideVotes() {
            setHidden(true)
        }

        function onSocketClearVotes() {
            // TODO: clear votes
        }

        socket.on('connection', onSocketConnect);
        socket.on('disconnect', onSocketDisconnect);

        // TODO: on errors (different kinds)

        socket.on('set-users', onSocketSetUsers);
        socket.on('add-user', onSocketAddUser);
        socket.on('remove-user', onSocketRemoveUser);
        socket.on('set-vote', onSocketSetVote);
        socket.on('show-votes', onSocketShowVotes);
        socket.on('hide-votes', onSocketHideVotes);
        socket.on('clear-votes', onSocketClearVotes);

        return () => {
            socket.disconnect()
        };
    }, []);


    const [hidden, setHidden] = React.useState<boolean>(true);

    const [users, setUsers] = React.useState<User[]>([{
        name: 'admiring-ganguly',
        avatar: avatar.getRandomAvatar(2),
    },
        {
            name: 'magical-nightingale',
            vote: '1.0',
            avatar: avatar.getRandomAvatar(2)
        },
        {
            name: 'zealous-goldberg',
            avatar: avatar.getRandomAvatar(2),
        },
        {
            name: 'amazing-brahmagupta',
            avatar: avatar.getRandomAvatar(2),
            vote: '2.0',
        },
        {
            name: 'vibrant-knuth',
            avatar: avatar.getRandomAvatar(2),
            vote: 'baum'
        }]);


    function onVoteChange(value: string) {
        onLocalHideVotes()
        setVote(props.user, value)
    }

    function setVote(user: string, vote: string) {
        const found = users.find(it => it.name === user)
        if (!found) return toast.error(`User ${user} not found!`)
        found.vote = vote
        setUsers(Array.from(users))
    }

    function onLocalShowVotes() {
        setHidden(false)
        socket.emit('show-votes')
    }

    function onLocalHideVotes() {
        setHidden(true)
        socket.emit('hide-votes')
    }

    function onLocalClearVotes() {
        // TODO: clear votes
        socket.emit('clear-votes')
    }

    function onLocalBack() {
        socket.disconnect()
        props.setProcess('JOIN')
    }

    React.useEffect(() => {
        const onUnload = () => {
            socket.disconnect()
        }

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
                                                <Vote onChange={onVoteChange}/> : user.vote ? hidden ?
                                                    <Hidden/> : user.vote : 'Still voting ...'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                        </CardContent>

                        <CardFooter className="flex-col gap-2">
                            <Button type="submit" className="w-full" onClick={onLocalShowVotes}
                                    disabled={!users.find(it => it.vote)}>
                                <Eye/> Show
                            </Button>

                            <Button type="submit" className="w-full" variant="secondary"
                                    onClick={onLocalHideVotes}>
                                <EyeOff/> Hide
                            </Button>

                            <Button type="submit" className="w-full" variant="secondary" onClick={onLocalClearVotes}>
                                <Trash2/> Clear
                            </Button>

                            <Button type="submit" className="w-full" onClick={onLocalBack}
                                    variant="secondary">
                                <CircleArrowLeft/> Back
                            </Button>
                        </CardFooter>
                    </div>

                    <div className="flex flex-col gap-6 bg-muted">

                        {hidden ? <div className="h-full flex items-center justify-center">
                                <p className="text-sm text-center">
                                    Still voting ...
                                </p>
                            </div> :

                            <ResultContent users={users}/>

                        }

                    </div>
                </div>

            </Card>

            <pre>{JSON.stringify(users, null, 4)}</pre>

        </div>
    )
}
