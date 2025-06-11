import type {MetaFunction} from "@remix-run/node";
import {JoinCard} from "~/components/app/join";
import React from "react";
import {RoomCard} from "~/components/app/room";
import randomName from '@scaleway/random-name'
import {Toaster} from "~/components/ui/sonner"

import {useSearchParams} from "@remix-run/react";


export const meta: MetaFunction = () => {
    return [
        {title: "planningpoker.stoetz.ms"},
        {name: "description", content: "Welcome to planningpoker.stoetz.ms!"},
    ];
};

export default function Index() {
    const [searchParams, setSearchParams] = useSearchParams();

    const [process, setProcess] = React.useState<string>('JOIN')

    const [room, setRoom] = React.useState<string>(getRoom())

    function getRoom() {
        const found = searchParams.get('room')
        if (found && found !== '') return found
        return randomName()
    }

    React.useEffect(() => {
        if (!searchParams.get('room')) {
            setSearchParam('room', room)
        }
    }, [room, searchParams, setSearchParams]);

    function onRoomChange(e: React.ChangeEvent<HTMLInputElement>) {
        const changed = e.target.value;
        setSearchParam('room', changed)
        setRoom(changed)
    }

    function setSearchParam(key: string, value: string) {
        setSearchParams(prev => {
            const params = new URLSearchParams(prev);
            params.set(key, value);
            return params;
        });
    }

    const [user, setUser] = React.useState<string>(getUser())

    function getUser() {
        const found = window.localStorage.getItem("user")
        if (found) return found

        const generated = randomName()
        window.localStorage.setItem("user", generated)
        return generated
    }

    function onUserChange(e: React.ChangeEvent<HTMLInputElement>) {
        const changed = e.target.value
        window.localStorage.setItem("user", changed)
        setUser(changed)
    }

    return (

        <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">

            <Toaster position="top-right"/>

            {process === "JOIN" ? (
                <div className="flex w-full max-w-sm flex-col gap-6">
                    <JoinCard
                        room={room}
                        onRoomChange={onRoomChange}

                        user={user}
                        onUserChange={onUserChange}

                        setProcess={setProcess}/>
                </div>
            ) : null}


            {process === "ROOM" ? (
                <div className="flex w-full max-w-6xl flex-col gap-6">
                    <RoomCard room={room} user={user} setProcess={setProcess}/>
                </div>
            ) : null}


        </div>
    );
}