import {useSearchParams} from '@remix-run/react'
import {useState} from 'react'
import {Card, CardContent} from '../ui/card'
import {findDiscussion} from '../../lib/discussion'
import {useRoom} from '../../lib/use-room'
import Actions from './actions'
import Comment from './comment'
import Debug from './debug'
import Error from './error'
import {ResultContent} from './result'
import RoomHeader from './room-header'
import Users from './users'

/**
 * A room: the users with their votes and the actions on the left, the result on the right once votes are shown.
 */
export function RoomCard(props: {room: string; user: string; setProcess: (process: string) => void}) {
    const [searchParams] = useSearchParams()
    const debug = searchParams.has('debug')

    const room = useRoom({
        room: props.room,
        user: props.user,
        seed: searchParams.has('seed'),
        debug,
        onLeft: () => props.setProcess('JOIN'),
    })

    const [presentation, setPresentation] = useState(false)

    // Users with the most opposite votes, who should discuss (once votes are shown)
    const discussion = room.hidden ? undefined : findDiscussion(room.votes)

    return (
        <div className="flex flex-col gap-6">
            <Error error={room.error} />

            {!room.joined && <JoiningCard room={props.room} />}

            {room.joined && (
                <Card className="overflow-hidden p-0 shadow-none animate-in fade-in duration-300">
                    <div className="grid grid-cols-1 p-0 lg:grid-cols-2 lg:grid-rows-[1fr_auto]">
                        <div className="flex min-w-0 flex-col gap-2 lg:col-start-1 lg:row-start-1 lg:gap-6">
                            <RoomHeader
                                name={props.room}
                                room={room}
                                presentation={presentation}
                                onPresentationChange={setPresentation}
                            />

                            <CardContent className="px-4 sm:px-6 lg:min-h-[450px]">
                                <Users
                                    room={room}
                                    me={props.user}
                                    presentation={presentation}
                                    discussion={discussion}
                                />

                                {!presentation && (
                                    <div className="pt-6">
                                        <Comment
                                            value={room.comment}
                                            onChange={room.setComment}
                                            saving={room.isPending('comment')}
                                            saved={room.commentSaved}
                                            locked={!room.hidden}
                                            disabled={!room.connected}
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </div>

                        <div className="flex min-w-0 flex-col gap-6 bg-muted lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:min-h-[200px]">
                            {room.hidden ? (
                                <div className="hidden h-full items-center justify-center lg:flex">
                                    <p className="text-sm text-center">Still voting ...</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 pb-4 duration-500 lg:pb-0">
                                    <ResultContent
                                        room={props.room}
                                        votes={room.votes}
                                        users={room.users}
                                        discussion={discussion}
                                        comments={room.comments}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="min-w-0 pb-4 lg:col-start-1 lg:row-start-2 lg:pb-0">
                            <Actions room={room} me={props.user} />
                        </div>
                    </div>
                </Card>
            )}

            {debug && <Debug room={room} />}
        </div>
    )
}

// Shown while connecting and joining the room
function JoiningCard(props: {room: string}) {
    return (
        <Card className="p-6 shadow-none">
            <p className="text-sm text-center">Joining {props.room} ...</p>
        </Card>
    )
}
