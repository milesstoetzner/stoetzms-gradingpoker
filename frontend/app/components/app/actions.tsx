import {Eye, EyeOff} from 'lucide-react'
import {Button} from '../ui/button'
import {CardFooter} from '../ui/card'
import {Room} from '../../lib/use-room'

/**
 * Showing and hiding the votes, for everyone in the room: one button which toggles.
 */
export default function Actions({room}: {room: Room}) {
    const anyVote = Object.values(room.voted).length > 0
    const disabled = !room.connected || room.isPending('toggle') || (room.hidden && !anyVote)

    return (
        <CardFooter className="px-4 pt-4 sm:px-6 lg:pt-0">
            <Button type="submit" className="w-full" onClick={room.toggleVotes} disabled={disabled}>
                {room.hidden ? (
                    <>
                        <Eye /> Show Votes
                    </>
                ) : (
                    <>
                        <EyeOff /> Hide Votes
                    </>
                )}
            </Button>
        </CardFooter>
    )
}
