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

// TODO: clear votes button

// TODO: show votes button

// TODO: sync any action via WebRTC (connect, disconnect, vote, show votes, clear votes)

type User = {
    name: string
    vote?: string | number
    avatar: string
}

type Distribution = {
    vote: string
    absolute: number
    relative: number
}


export function RoomCard(props: {
    room: string,
    user: string,
    setProcess: (process: string) => void;
}) {

    const [hidden, setHidden] = React.useState<boolean>(true);

    const [users, setUsers] = React.useState<User[]>([{
        name: 'admiring-ganguly',
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

    // TODO: how to call this only once?
    function getVotes() {
        const total = users.length
        const values = users.map(it => it.vote)
        const strings = users.map(it => String(it.vote))
        const numbers = users.map(it => Number(it.vote)).filter(it => !Number.isNaN(it))

        let distribution: Distribution[] = []
        strings.forEach(vote => {
            const found = distribution.find(it => it.vote === vote)

            if (found) {
                found.absolute++
            } else {
                distribution.push({
                    vote,
                    absolute: 1,
                    relative: -1,
                })
            }
        })
        distribution = distribution.map(it => ({
            vote: it.vote,
            absolute: it.absolute,
            relative: it.absolute / total * 100,
        }))
        distribution = distribution.sort((a, b) => b.absolute - a.absolute)

        console.log(distribution)

        const most = distribution[0].vote

        return {
            total,
            values,
            numbers,
            median: median(numbers),
            average: average(numbers),
            most,
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

                            <React.Fragment>
                                <CardHeader>
                                    <CardTitle>Result</CardTitle>
                                </CardHeader>

                                <CardContent>

                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Statistic</TableHead>
                                                <TableHead>Value</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            <TableRow  className="h-[57px]">
                                                <TableCell>
                                                    Votes
                                                </TableCell>
                                                <TableCell>
                                                    {getVotes().total}
                                                </TableCell>
                                            </TableRow>


                                            <TableRow  className="h-[57px]">
                                                <TableCell>
                                                    Average
                                                </TableCell>
                                                <TableCell>
                                                    {getVotes().average.toFixed(2)}
                                                </TableCell>
                                            </TableRow>


                                            <TableRow  className="h-[57px]">
                                                <TableCell>
                                                    Median
                                                </TableCell>
                                                <TableCell>
                                                    {getVotes().median.toFixed(2)}
                                                </TableCell>
                                            </TableRow>


                                            <TableRow  className="h-[57px]">
                                                <TableCell>
                                                    Most
                                                </TableCell>
                                                <TableCell>
                                                    {getVotes().most}
                                                </TableCell>
                                            </TableRow>

                                            <TableRow  className="h-[57px]">
                                                <TableCell>
                                                    Distribution
                                                </TableCell>
                                                <TableCell>
                                                    <table>
                                                        <tbody>
                                                        {getVotes().distribution.map(dist => (
                                                            <tr key={dist.vote}>
                                                                <td className="w-[100px]">{dist.vote}</td>
                                                                <td className="w-[50px]">{dist.absolute}</td>
                                                                <td>{dist.relative.toFixed(0)}&#37;</td>
                                                            </tr>
                                                        ))}
                                                        </tbody>
                                                    </table>
                                                </TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>


                                </CardContent>
                            </React.Fragment>
                        }

                    </div>
                </div>

            </Card>
        </div>
    )
}
