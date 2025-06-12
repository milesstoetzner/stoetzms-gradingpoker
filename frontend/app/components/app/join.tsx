import {Button} from '../ui/button'
import {Card, CardContent, CardFooter, CardHeader, CardTitle} from '../ui/card'
import {Input} from '../ui/input'
import {Label} from '../ui/label'
import React from 'react'
import {ArrowLeft, ArrowLeftCircle, ArrowRightCircle, ArrowRightLeft, RefreshCw, Vote} from 'lucide-react'
import Hover from './hover'

export function JoinCard(props: {
    room: string
    onRoomChange: (event: React.ChangeEvent<HTMLInputElement>) => void
    onRoomGenerate: () => void

    user: string
    onUserChange: (event: React.ChangeEvent<HTMLInputElement>) => void
    onUserGenerate: () => void

    setProcess: (process: string) => void
}) {
    return (
        <Card className="w-full max-w-sm shadow-none">
            <CardHeader className="mb-4">
                <CardTitle>planningpoker.stoetz.ms</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-6">
                    <div className="grid gap-2">
                        <Label htmlFor="room">Room</Label>
                        <div className="flex w-full max-w-sm items-center gap-2">
                            <Input id="room" type="text" value={props.room} onChange={props.onRoomChange} required />

                            <Hover message="Regenerate room">
                                <Button variant="outline" onClick={props.onRoomGenerate}>
                                    <RefreshCw size="icon" />
                                </Button>
                            </Hover>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="user">User</Label>
                        <div className="flex w-full max-w-sm items-center gap-2">
                            <Input id="user" type="text" value={props.user} onChange={props.onUserChange} required />

                            <Hover message="Regenerate user">
                                <Button variant="outline" onClick={props.onUserGenerate}>
                                    <RefreshCw size="icon" />
                                </Button>
                            </Hover>
                        </div>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex-col gap-2">
                <Button className="w-full" onClick={() => props.setProcess('ROOM')}>
                    <ArrowRightCircle /> Join
                </Button>
            </CardFooter>
        </Card>
    )
}
