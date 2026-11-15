import {Button} from '../ui/button'
import {Room} from '../../lib/use-room'

/**
 * Tools for debugging (?debug): connect and disconnect by hand and see the state of the room.
 */
export default function Debug({room}: {room: Room}) {
    const {connected, vote, hidden, users, votes, voted} = room

    return (
        <div className="flex flex-col gap-6 pt-12">
            <Button type="submit" className="w-full" onClick={() => room.socket.connect()} variant="secondary">
                Socket Connect
            </Button>

            <Button type="submit" className="w-full" onClick={() => room.socket.disconnect()} variant="secondary">
                Socket Disconnect
            </Button>

            <pre>{JSON.stringify({debug: true, connected, vote, hidden, users, votes, voted}, null, 4)}</pre>
        </div>
    )
}
