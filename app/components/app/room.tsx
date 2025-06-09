import {Button} from "~/components/ui/button"
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import React from "react";

// TODO: button to share url

// TODO: vote buttons (two scales?!)

// TODO: connected users and their votes

// TODO: clear votes button

// TODO: show votes button

// TODO: result box

export function RoomCard(props: {
    room: string,
    user: string,
    setProcess: (process: string) => void;
}) {

    return (
        <Card className="w-full max-w-sm">
            <CardHeader>
                <CardTitle>{props.room}</CardTitle>
                <CardTitle>{props.user}</CardTitle>
            </CardHeader>
            <CardContent>


            </CardContent>
            <CardFooter className="flex-col gap-2">
                <Button type="submit" className="w-full" onClick={() => props.setProcess('JOIN')}>
                    Back
                </Button>
            </CardFooter>
        </Card>
    )
}
