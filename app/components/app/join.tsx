import {Button} from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import {Input} from "~/components/ui/input"
import {Label} from "~/components/ui/label"
import React from "react";


export function JoinCard(props: {
    room: string,
    onRoomChange: (event: React.ChangeEvent<HTMLInputElement>) => void,

    user: string,
    onUserChange: (event: React.ChangeEvent<HTMLInputElement>) => void,

    setProcess: (process: string) => void;
}) {

    return (
        <Card className="w-full max-w-sm">
            <CardHeader>
                <CardTitle>planningpoker.stoetz.ms</CardTitle>
            </CardHeader>
            <CardContent>
                <form>
                    <div className="flex flex-col gap-6">
                        <div className="grid gap-2">
                            <Label htmlFor="room">Room</Label>
                            <Input id="room" type="text" value={props.room} onChange={props.onRoomChange}
                                   required/>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="user">User</Label>
                            <Input id="user" type="text" value={props.user} onChange={props.onUserChange} required/>
                        </div>
                    </div>
                </form>
            </CardContent>
            <CardFooter className="flex-col gap-2">
                <Button type="submit" className="w-full" onClick={() => props.setProcess('ROOM')}>
                    Join
                </Button>
            </CardFooter>
        </Card>
    )
}
