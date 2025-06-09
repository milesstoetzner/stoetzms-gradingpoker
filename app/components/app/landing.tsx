import {Button} from "~/components/ui/button"
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import {Input} from "~/components/ui/input"
import {Label} from "~/components/ui/label"

export function CardDemo() {

    // TODO: read room from url
    // TODO: read user from localstorage

    // TODO: auto generate default room
    // TODO: auto generate default user

    return (
        <Card className="w-full max-w-sm">
            <CardHeader>
                <CardTitle>planningpoker.stoetz.ms</CardTitle>
                <CardDescription>
                    Enter a room name and your user name. No login required! No room creation required!
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form>
                    <div className="flex flex-col gap-6">
                        <div className="grid gap-2">
                            <Label htmlFor="room">Room</Label>
                            <Input id="room" type="text" required/>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="user">User</Label>
                            <Input id="user" type="text" required/>
                        </div>
                    </div>
                </form>
            </CardContent>
            <CardFooter className="flex-col gap-2">
                <Button type="submit" className="w-full">
                    Join
                </Button>
            </CardFooter>
        </Card>
    )
}
