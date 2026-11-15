import {Trash2} from 'lucide-react'
import {Button} from '../ui/button'
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../ui/dialog'

/**
 * Button which closes the room for everyone after a confirmation.
 */
export default function Close(props: {onClick: () => void; disabled: boolean; pending: boolean}) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button type="submit" className="w-full" variant="secondary" disabled={props.disabled}>
                    <Trash2 />{' '}
                    <span>
                        Close<span className="hidden sm:inline"> Room</span>
                    </span>
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Close Room</DialogTitle>
                    <DialogDescription>Do you really want to the close the room and reset its state?</DialogDescription>
                </DialogHeader>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">No</Button>
                    </DialogClose>
                    <Button type="submit" onClick={props.onClick} disabled={props.pending}>
                        Yes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
