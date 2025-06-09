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
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table"

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
}

export function RoomCard(props: {
    room: string,
    user: string,
    setProcess: (process: string) => void;
}) {


    const [users, setUsers] = React.useState<User[]>([{
        name: 'magical-nightingale'
    },
        {
            name: 'magical-nightingale'
        },
        {
            name: 'zealous-goldberg'
        },
        {
            name: 'amazing-brahmagupta'
        },
        {
            name: 'vibrant-knuth'
        }]);

    return (
        <div className="flex flex-col gap-6">
            <Card className="overflow-hidden p-0">
                <CardContent className="grid p-0 md:grid-cols-2">
                    <div className="flex flex-col gap-6">
                        <CardHeader>
                            <CardTitle>{props.room}</CardTitle>
                        </CardHeader>

                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead></TableHead>
                                    <TableHead>User</TableHead>
                                    <TableHead>Vote</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow>
                                        <TableCell>
                                            <Avatar className="border-gray-300" style={{borderWidth: '1px'}}>
                                                <AvatarImage
                                                    src={`data:image/svg+xml;base64,${btoa(avatar.getRandomAvatar(2))}`}></AvatarImage>
                                            </Avatar>
                                        </TableCell>
                                        <TableCell>{user.name}</TableCell>
                                        <TableCell>{user.vote}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>


                        <CardFooter className="flex-col gap-2">
                            <Button type="submit" className="w-full" onClick={() => props.setProcess('JOIN')}>
                                Back
                            </Button>
                        </CardFooter>
                    </div>

                    <div className="bg-muted relative hidden md:block">

                    </div>
                </CardContent>

            </Card>
        </div>
    )
}
