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


import average from 'average'
import median from 'median'

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table"
import {CircleArrowLeft, Eye, EyeOff, Trash2} from "lucide-react";

// TODO: button to share url

// TODO: vote buttons (two scales?!)

// TODO: connected users and their votes

// TODO: clear votes button

// TODO: show votes button

// TODO: result box

// TODO: sync any action via WebRTC (connect, disconnect, vote, show votes, clear votes)

type User = {
    name: string
    vote?: string
    avatar: string
}

type Distribution = {
    [key: string]: {
        absolute: number
        relative: number
    }
}

export function RoomCard(props: {
    room: string,
    user: string,
    setProcess: (process: string) => void;
}) {

    const [hidden, setHidden] = React.useState<boolean>(true);


    const [users, setUsers] = React.useState<User[]>([{
        name: 'magical-nightingale',
        avatar: avatar.getRandomAvatar(2)
    },
        {
            name: 'magical-nightingale',
            vote: 1,
            avatar: avatar.getRandomAvatar(2)
        },
        {
            name: 'zealous-goldberg',
            avatar: avatar.getRandomAvatar(2),
            vote: 1,
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

    const HiddenLabel =
        <Button className="w-full cursor-default hover:bg-black"><EyeOff/> Hidden</Button>

    function getVotes() {
        const total = users.length
        const values = users.map(it => it.vote)
        const strings = users.map(it => String(it.vote))
        const numbers = users.map(it => Number(it.vote)).filter(it => !Number.isNaN(it))

        const distribution: Distribution = strings.reduce<Distribution>((acc, cur) => {
            const counter = acc[cur]
            if (!counter) acc[cur] = {
                absolute: 0,
                relative: 0,
            }
            acc[cur].absolute += 1
            // TODO: calculate this at the end
            acc[cur].relative += 1

            return acc
        }, {})

        return {
            total,
            values,
            numbers,
            median: median(numbers),
            average: average(numbers),
            distribution
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <Card className="overflow-hidden p-0">
                <div className="grid p-0 md:grid-cols-2">
                    <div className="flex flex-col gap-6">
                        <CardHeader>
                            <CardTitle>{props.room}</CardTitle>
                        </CardHeader>

                        <CardContent>

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
                                        <TableRow>
                                            <TableCell>
                                                <Avatar className="border-gray-300" style={{borderWidth: '1px'}}>
                                                    <AvatarImage
                                                        src={`data:image/svg+xml;base64,${btoa(user.avatar)}`}></AvatarImage>
                                                </Avatar>
                                            </TableCell>
                                            <TableCell>{user.name}</TableCell>
                                            <TableCell>{user.vote ? hidden ? HiddenLabel : user.vote : 'Still voting ...'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                        </CardContent>

                        <CardFooter className="flex-col gap-2">
                            <Button type="submit" className="w-full" onClick={() => setHidden(false)}>
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

                    <div className="bg-muted relative hidden md:block">

                        {hidden ? 'Still voting ...' :

                            <React.Fragment>
                                <CardHeader>
                                    <CardTitle>Result</CardTitle>
                                </CardHeader>

                                <CardContent>

                                    {getVotes().numbers} <br/>
                                    {getVotes().values}

                                    Votes: {getVotes().total} <br/>
                                    Average: {average(getVotes().numbers)} <br/>
                                    Median: {median(getVotes().numbers)} <br/>

                                    Distribution: <br/>

                                    {Object.entries(getVotes().distribution).map(([key, data]) => (
                                        <React.Fragment key={key}>
                                            {key}: {data.absolute} ({data.relative})
                                        </React.Fragment>
                                    ))}

                                </CardContent>
                            </React.Fragment>
                        }

                    </div>
                </div>

            </Card>
        </div>
    )
}
