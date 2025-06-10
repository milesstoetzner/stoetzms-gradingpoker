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

// TODO: clear votes button

// TODO: show votes button

// TODO: sync any action via WebRTC (connect, disconnect, vote, show votes, clear votes)

// TODO: remove internal state

export type User = {
    name: string
    vote?: string | number
    avatar: string
}


export function RoomCard(props: {
    room: string,
    user: string,
    setProcess: (process: string) => void;
}) {

    const [hidden, setHidden] = React.useState<boolean>(true);

    const [users, setUsers] = React.useState<User[]>([{
        name: 'admiring-ganguly',
        avatar: avatar.getRandomAvatar(2),
    },
        {
            name: 'magical-nightingale',
            vote: 1,
            avatar: avatar.getRandomAvatar(2)
        },
        {
            name: 'zealous-goldberg',
            avatar: avatar.getRandomAvatar(2),
        },
        {
            name: 'amazing-brahmagupta',
            avatar: avatar.getRandomAvatar(2),
            vote: 2,
        },
        {
            name: 'vibrant-knuth',
            avatar: avatar.getRandomAvatar(2),
            vote: 'baum'
        }]);


    function onVoteChange(value: string) {
        // TODO: publish vote
        setVote(props.user, value)
    }

    function setVote(user: string, vote: string | number) {
        const found = users.find(it => it.name === user)
        if (!found) return toast.error(`User ${user} not found!`)
        found.vote = vote
        setUsers(Array.from(users))
    }

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

                        <CardContent className="min-h-[400px]">
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
                            <Button type="submit" className="w-full" onClick={() => setHidden(false)}
                                    disabled={!users.find(it => it.vote)}>
                                <Eye/> Show
                            </Button>

                            <Button type="submit" className="w-full" variant="secondary"
                                    onClick={() => setHidden(true)}>
                                <EyeOff/> Hide
                            </Button>

                            <Button type="submit" className="w-full" variant="secondary">
                                <Trash2/> Clear
                            </Button>

                            <Button type="submit" className="w-full" onClick={() => props.setProcess('JOIN')}
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
