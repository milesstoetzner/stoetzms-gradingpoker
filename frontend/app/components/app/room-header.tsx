import {Presentation, RefreshCw} from 'lucide-react'
import {Button} from '../ui/button'
import {CardHeader, CardTitle} from '../ui/card'
import {Room} from '../../lib/use-room'
import Hover from './hover'
import Share from './share'

/**
 * Name of the room with the buttons for the presentation mode, refreshing and sharing.
 */
export default function RoomHeader(props: {
    name: string
    room: Room
    presentation: boolean
    onPresentationChange: (presentation: boolean) => void
}) {
    return (
        <CardHeader
            className="flex flex-row items-center justify-between gap-2 px-4 sm:px-6"
            style={{marginTop: '-12px', marginBottom: '-10px'}}
        >
            <CardTitle className="min-w-0 truncate leading-normal" title={props.name}>
                {props.name}
            </CardTitle>

            <span className="ml-auto flex shrink-0 items-center gap-2">
                <Hover message="Presentation Mode">
                    <Button
                        variant={props.presentation ? 'default' : 'outline'}
                        className="size-8"
                        onClick={() => props.onPresentationChange(!props.presentation)}
                    >
                        <Presentation size="icon" />
                    </Button>
                </Hover>

                <Hover message="Refresh Room">
                    <Button
                        variant="outline"
                        className="size-8"
                        onClick={props.room.refresh}
                        disabled={!props.room.connected || props.room.isPending('refresh')}
                    >
                        <RefreshCw size="icon" />
                    </Button>
                </Hover>

                <Share />
            </span>
        </CardHeader>
    )
}
