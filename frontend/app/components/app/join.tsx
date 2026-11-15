import {Button} from '../ui/button'
import {Card, CardContent, CardFooter, CardHeader, CardTitle} from '../ui/card'
import {Input} from '../ui/input'
import {ButtonGroup} from '../ui/button-group'
import {Label} from '../ui/label'
import React from 'react'
import {ArrowRightCircle, RefreshCw} from 'lucide-react'
import Hover from './hover'
import {validateName} from '../../../../spec/types'
import {Logo} from './logo'

export function JoinCard(props: {
    room: string
    onRoomChange: (event: React.ChangeEvent<HTMLInputElement>) => void
    onRoomGenerate: () => void

    user: string
    onUserChange: (event: React.ChangeEvent<HTMLInputElement>) => void
    onUserGenerate: () => void

    setProcess: (process: string) => void
}) {
    const roomError = validateName(props.room)
    const userError = validateName(props.user)

    return (
        <Card className="w-full max-w-sm shadow-none">
            <CardHeader className="mb-4">
                <CardTitle className="flex items-center gap-3">
                    <Logo />
                    gradingpoker.stoetz.ms
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-6">
                    <div className="grid gap-2">
                        <Label htmlFor="room">Room</Label>
                        <ButtonGroup className="w-full max-w-sm">
                            <Input
                                id="room"
                                type="text"
                                value={props.room}
                                onChange={props.onRoomChange}
                                aria-invalid={!!roomError}
                                required
                            />

                            <Hover message="Regenerate Room">
                                <Button variant="outline" className="shrink-0" onClick={props.onRoomGenerate}>
                                    <RefreshCw />
                                </Button>
                            </Hover>
                        </ButtonGroup>
                        {roomError && <p className="text-sm text-destructive">{roomError}</p>}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="user">User</Label>
                        <ButtonGroup className="w-full max-w-sm">
                            <Input
                                id="user"
                                type="text"
                                value={props.user}
                                onChange={props.onUserChange}
                                aria-invalid={!!userError}
                                required
                            />

                            <Hover message="Regenerate User">
                                <Button variant="outline" className="shrink-0" onClick={props.onUserGenerate}>
                                    <RefreshCw />
                                </Button>
                            </Hover>
                        </ButtonGroup>
                        {userError && <p className="text-sm text-destructive">{userError}</p>}
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex-col gap-2">
                <Button
                    className="w-full"
                    onClick={() => props.setProcess('ROOM')}
                    disabled={!!roomError || !!userError}
                >
                    <ArrowRightCircle /> Join
                </Button>
            </CardFooter>
        </Card>
    )
}
