import {CircleArrowLeft, Eye, EyeOff} from 'lucide-react'
import {Button} from '../ui/button'
import {CardFooter} from '../ui/card'
import {Room} from '../../lib/use-room'
import Close from './close'
import Kick from './kick'

/**
 * What everyone in the room can do: show and hide the votes, remove a user, close and leave the room.
 */
export default function Actions({room, me}: {room: Room; me: string}) {
    const anyVote = Object.values(room.voted).length > 0

    return (
        <CardFooter className="grid grid-cols-2 gap-2 px-4 pt-4 sm:px-6 lg:pt-0">
            <Button
                type="submit"
                className="w-full"
                onClick={room.showVotes}
                disabled={!anyVote || !room.connected || room.isPending('show')}
            >
                <Eye /> Show Votes
            </Button>

            <Button
                type="submit"
                className="w-full"
                variant="secondary"
                onClick={room.hideVotes}
                disabled={!room.connected || room.isPending('hide')}
            >
                <EyeOff /> Hide Votes
            </Button>

            <div className="col-span-2 grid grid-cols-3 gap-2">
                <Kick
                    users={room.users}
                    me={me}
                    onClick={room.removeUser}
                    disabled={!room.connected}
                    pending={room.isPending('remove')}
                />

                <Close onClick={room.closeRoom} disabled={!room.connected} pending={room.isPending('close')} />

                <Button
                    type="submit"
                    className="w-full"
                    onClick={room.leave}
                    variant="secondary"
                    disabled={!room.connected}
                >
                    <CircleArrowLeft />{' '}
                    <span>
                        Leave<span className="hidden sm:inline"> Room</span>
                    </span>
                </Button>
            </div>
        </CardFooter>
    )
}
