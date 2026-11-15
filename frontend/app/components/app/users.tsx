import {Avatar, AvatarImage} from '../ui/avatar'
import {Badge} from '../ui/badge'
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '../ui/table'
import {User} from '../../../../spec/types'
import {avatarOf} from '../../lib/avatar'
import {Discussion} from '../../lib/discussion'
import {Room} from '../../lib/use-room'
import Ballot from './ballot'
import Hidden from './hidden'
import Hover from './hover'
import Vote from './vote'

type Props = {
    room: Room
    // Name of the own user
    me: string
    // Presentation mode shows the own user like everyone else
    presentation: boolean
    discussion?: Discussion
}

/**
 * The users of the room with their votes. The own row has the ballot.
 */
export default function Users(props: Props) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[0px] px-1 sm:px-2">User</TableHead>
                    <TableHead className="px-1 sm:px-2"></TableHead>
                    <TableHead className="w-[45%] px-1 sm:w-[125px] sm:px-2">Vote</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {props.room.users.map(user => (
                    <UserRow key={user.name} user={user} {...props} />
                ))}
            </TableBody>
        </Table>
    )
}

function UserRow({user, room, me, presentation, discussion}: Props & {user: User}) {
    const own = user.name === me && !presentation
    const discusses =
        !!discussion && (discussion.low.users.includes(user.name) || discussion.high.users.includes(user.name))

    return (
        <TableRow className="animate-in fade-in duration-300">
            <TableCell className="px-1 sm:px-2">
                <Avatar style={{borderWidth: '1px'}} className={user.online ? '' : 'opacity-40'}>
                    <AvatarImage src={`data:image/svg+xml;base64,${btoa(avatarOf(user.name))}`}></AvatarImage>
                </Avatar>
            </TableCell>

            <TableCell className="break-words px-1 sm:px-2">
                {user.name} {own && <Badge className="ml-[0.5rem]">me</Badge>}
                {discusses && (
                    <Hover message="Most opposite vote, please discuss">
                        <span className="ml-[0.5rem] inline-flex animate-in fade-in">
                            <Badge className="bg-amber-500 text-white hover:bg-amber-500">discuss</Badge>
                        </span>
                    </Hover>
                )}
                {!user.online && (
                    <Hover message="Lost connection, keeps their vote for a while">
                        <span className="ml-[0.5rem] inline-flex">
                            <Badge variant="outline" className="text-muted-foreground">
                                offline
                            </Badge>
                        </span>
                    </Hover>
                )}
            </TableCell>

            <TableCell className="px-1 sm:px-2">
                {own ? (
                    <Ballot value={room.vote} onChange={room.setVote} disabled={!room.connected} />
                ) : !room.voted[user.name] ? (
                    'Still voting ...'
                ) : room.hidden ? (
                    <Hidden />
                ) : (
                    <span className="block animate-in fade-in zoom-in-95 duration-300">
                        <Vote vote={room.votes[user.name]} />
                    </span>
                )}
            </TableCell>
        </TableRow>
    )
}
