import type {MetaFunction} from '@remix-run/node'
import {JoinCard} from '../components/app/join'
import React from 'react'
import {RoomCard} from '../components/app/room'
import randomName from '@scaleway/random-name'
import {Toaster} from '../components/ui/sonner'

import {useSearchParams} from '@remix-run/react'

export const meta: MetaFunction = () => {
    return [{title: 'gradingpoker.stoetz.ms'}, {name: 'description', content: 'Welcome to gradingpoker.stoetz.ms!'}]
}

const KEY_ROOM = 'room'
const KEY_USER = 'user'

export default function Index() {
    const [searchParams, setSearchParams] = useSearchParams()

    const [process, setProcess] = React.useState<string>('JOIN')

    const [room, setRoom] = React.useState<string>(getRoom())

    function getRoom() {
        const found = searchParams.get(KEY_ROOM)
        if (found && found !== '') return found
        return randomName()
    }

    React.useEffect(() => {
        if (!searchParams.get(KEY_ROOM)) {
            setSearchParam(KEY_ROOM, room)
        }
    }, [room, searchParams, setSearchParams])


    function onRoomGenerate() {
        const generated = randomName()
        setSearchParam(KEY_ROOM, generated)
        setRoom(generated)
    }

    function onRoomChange(e: React.ChangeEvent<HTMLInputElement>) {
        const changed = e.target.value
        setSearchParam(KEY_ROOM, changed)
        setRoom(changed)
    }

    function setSearchParam(key: string, value: string) {
        setSearchParams(prev => {
            const params = new URLSearchParams(prev)
            params.set(key, value)
            return params
        })
    }

    const [user, setUser] = React.useState<string>(getUser())

    function getUser() {
        const param = searchParams.get(KEY_USER)
        if (param && param !== '') return param

        const found = window.localStorage.getItem(KEY_USER)
        if (found) return found

        const generated = randomName()
        window.localStorage.setItem(KEY_USER, generated)
        return generated
    }

    function onUserChange(e: React.ChangeEvent<HTMLInputElement>) {
        const changed = e.target.value
        window.localStorage.setItem(KEY_USER, changed)
        setUser(changed)
    }

    function onUserGenerate() {
        const generated = randomName()
        window.localStorage.setItem(KEY_USER, generated)
        setUser(generated)
    }

    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
            <Toaster position="top-right" expand={true} />

            {process === 'JOIN' ? (
                <div className="flex w-full max-w-sm flex-col gap-6">
                    <JoinCard
                        room={room}
                        onRoomChange={onRoomChange}
                        onRoomGenerate={onRoomGenerate}
                        user={user}
                        onUserChange={onUserChange}
                        onUserGenerate={onUserGenerate}
                        setProcess={setProcess}
                    />

                    <a
                        href="https://www.uni-stuttgart.de/impressum"
                        target="_blank"
                        rel="noopener"
                        className="text-sm text-neutral-500 mt-[-1rem] text-center"
                    >
                        Impressum
                    </a>
                </div>
            ) : null}

            {process === 'ROOM' ? (
                <div className="flex w-full max-w-6xl flex-col gap-6">
                    <RoomCard room={room} user={user} setProcess={setProcess} />
                </div>
            ) : null}
        </div>
    )
}
