import {CircleArrowLeft, EllipsisVertical, Presentation, RefreshCw, Trash2, UserX} from 'lucide-react'
import {useState} from 'react'
import {Button} from '../ui/button'
import {ButtonGroup} from '../ui/button-group'
import {CardHeader, CardTitle} from '../ui/card'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import {Room} from '../../lib/use-room'
import Close from './close'
import Hover from './hover'
import Kick from './kick'
import Share from './share'

/**
 * Name of the room with the buttons for the presentation mode, refreshing and sharing, and a menu for removing users,
 * closing and leaving the room.
 */
export default function RoomHeader(props: {
    name: string
    room: Room
    me: string
    presentation: boolean
    onPresentationChange: (presentation: boolean) => void
}) {
    const {room} = props
    const [dialog, setDialog] = useState<'remove' | 'close'>()
    const othersInRoom = room.users.some(user => user.name !== props.me)

    return (
        <CardHeader
            className="flex flex-row items-center justify-between gap-2 px-4 sm:px-6"
            style={{marginTop: '-12px', marginBottom: '-10px'}}
        >
            <CardTitle className="min-w-0 truncate leading-normal" title={props.name}>
                {props.name}
            </CardTitle>

            <ButtonGroup className="ml-auto shrink-0">
                <Hover message="Presentation Mode">
                    <Button
                        variant={props.presentation ? 'default' : 'outline'}
                        className="size-8"
                        onClick={() => props.onPresentationChange(!props.presentation)}
                    >
                        <Presentation />
                    </Button>
                </Hover>

                <Hover message="Refresh Room">
                    <Button
                        variant="outline"
                        className="size-8"
                        onClick={room.refresh}
                        disabled={!room.connected || room.isPending('refresh')}
                    >
                        <RefreshCw />
                    </Button>
                </Hover>

                <Share />

                {/* Not modal, otherwise the dialogs opened from it stay unclickable */}
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="size-8" aria-label="More">
                            <EllipsisVertical />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem
                            disabled={!room.connected || !othersInRoom}
                            onSelect={() => setDialog('remove')}
                        >
                            <UserX /> Remove User
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={!room.connected} onSelect={() => setDialog('close')}>
                            <Trash2 /> Close Room
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={room.leaveRoom}>
                            <CircleArrowLeft /> Leave Room
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </ButtonGroup>

            <Kick
                open={dialog === 'remove'}
                onOpenChange={open => setDialog(open ? 'remove' : undefined)}
                users={room.users}
                me={props.me}
                onRemove={room.removeUser}
            />

            <Close
                open={dialog === 'close'}
                onOpenChange={open => setDialog(open ? 'close' : undefined)}
                onClose={room.closeRoom}
                pending={room.isPending('close')}
            />
        </CardHeader>
    )
}
