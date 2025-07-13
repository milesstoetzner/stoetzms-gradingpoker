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


export default function Kick(props: { users: User[], onClick: (value: string) => void, disabled: boolean }) {
    const [user, setUser] = useState<string | undefined>()

    const [open, setOpen] = useState<boolean>(false)

    function onKick() {
        if (!user) return
        props.onClick(user)
        onKick()
    }

    function onClose() {
        setOpen(false)
        setUser(undefined)
    }

    return <Dialog open={open}>
        <DialogTrigger asChild>
            <Button type="submit" onClick={() => setOpen(true)} className="w-full" variant="secondary"
                    disabled={props.disabled}>
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
                        {props.users.map((user: User) => <SelectItem value={user.name}>{user.name}</SelectItem>)}
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