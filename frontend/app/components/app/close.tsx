import {Button} from '../ui/button'
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog'

/**
 * Dialog which closes the room for everyone after a confirmation.
 */
export default function Close(props: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onClose: () => void
    pending: boolean
}) {
    return (
        <Dialog open={props.open} onOpenChange={props.onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Close Room</DialogTitle>
                    <DialogDescription>Do you really want to the close the room and reset its state?</DialogDescription>
                </DialogHeader>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">No</Button>
                    </DialogClose>
                    <Button type="submit" onClick={props.onClose} disabled={props.pending}>
                        Yes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
