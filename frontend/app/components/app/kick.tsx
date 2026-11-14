import {
    Dialog, DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "../ui/dialog";
import {Button} from "../ui/button";
import {UserX} from "lucide-react";
import React, {useState} from "react";
import {Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue} from "../ui/select";
import {User} from "../../../../spec/types";


export default function Kick(props: { users: User[], me: string, onClick: (value: string) => void, disabled: boolean, pending?: boolean }) {
    const [user, setUser] = useState<string | undefined>()

    const [open, setOpen] = useState<boolean>(false)

    function onKick() {
        if (!user) return
        props.onClick(user)
        onClose()
    }

    function onClose() {
        setOpen(false)
        setUser(undefined)
    }

    function onOpenChange(next: boolean) {
        if (next) return setOpen(true)
        onClose()
    }

    const others = props.users.filter(it => it.name !== props.me)

    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
            <Button type="submit" className="w-full" variant="secondary"
                    disabled={props.disabled || !others.length || props.pending}>
                <UserX/> Remove User
            </Button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>Remove User</DialogTitle>
                <DialogDescription>
                    Do you really want to remove the following user?
                </DialogDescription>
            </DialogHeader>

            <Select value={user} onValueChange={setUser}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="User"/>
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup className="pb-2">
                        {others.map((user: User) => <SelectItem key={user.name} value={user.name}>{user.name}</SelectItem>)}
                    </SelectGroup>
                </SelectContent>
            </Select>

            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline" onClick={onClose}>No</Button>
                </DialogClose>
                <Button type="submit" onClick={onKick} disabled={!user}>
                    Yes
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
}