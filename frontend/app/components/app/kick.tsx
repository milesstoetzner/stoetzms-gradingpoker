import {useState} from 'react'
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog'
import {Button} from '../ui/button'
import {Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue} from '../ui/select'
import {User} from '../../../../spec/types'

/**
 * Dialog which removes another user from the room after choosing them.
 */
export default function Kick(props: {
    open: boolean
    onOpenChange: (open: boolean) => void
    users: User[]
    me: string
    onRemove: (user: string) => void
}) {
    const [user, setUser] = useState<string>()
    const others = props.users.filter(other => other.name !== props.me)

    function onOpenChange(open: boolean) {
        if (!open) setUser(undefined)
        props.onOpenChange(open)
    }

    function onRemove() {
        if (!user) return
        props.onRemove(user)
        onOpenChange(false)
    }

    return (
        <Dialog open={props.open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Remove User</DialogTitle>
                    <DialogDescription>Do you really want to remove the following user?</DialogDescription>
                </DialogHeader>

                <Select value={user} onValueChange={setUser}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="User" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup className="pb-2">
                            {others.map(other => (
                                <SelectItem key={other.name} value={other.name}>
                                    {other.name}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">No</Button>
                    </DialogClose>
                    <Button type="submit" onClick={onRemove} disabled={!user}>
                        Yes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
