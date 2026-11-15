import {useSearchParams} from '@remix-run/react'
import generateName from '@scaleway/random-name'
import React from 'react'

const KEY_ROOM = 'room'
const KEY_USER = 'user'

type Name = {
    value: string
    change: (value: string) => void
    // Replaces the name by a random one
    generate: () => void
}

/**
 * Name of the room, kept in the URL so that the room can be shared as a link. Random unless the URL names one.
 */
export function useRoomName(): Name {
    const [searchParams, setSearchParams] = useSearchParams()
    const [room, setRoom] = React.useState(() => searchParams.get(KEY_ROOM) || generateName())

    const change = React.useCallback(
        (value: string) => {
            setRoom(value)
            // Replace instead of push, otherwise every keystroke creates a history entry
            setSearchParams(
                previous => {
                    const params = new URLSearchParams(previous)
                    params.set(KEY_ROOM, value)
                    return params
                },
                {replace: true}
            )
        },
        [setSearchParams]
    )

    // A generated room is not in the URL yet
    React.useEffect(() => {
        if (!searchParams.get(KEY_ROOM)) change(room)
    }, [room, searchParams, change])

    return {value: room, change, generate: () => change(generateName())}
}

/**
 * Name of the user, remembered by the browser. Random at the first visit, unless the URL names one.
 */
export function useUserName(): Name {
    const [searchParams] = useSearchParams()
    const [user, setUser] = React.useState(() => {
        const fromUrl = searchParams.get(KEY_USER)
        if (fromUrl) return fromUrl

        const remembered = window.localStorage.getItem(KEY_USER)
        if (remembered) return remembered

        const generated = generateName()
        window.localStorage.setItem(KEY_USER, generated)
        return generated
    })

    function change(value: string) {
        // An empty name is only a moment while typing, the browser keeps remembering the last real one
        if (value.trim()) window.localStorage.setItem(KEY_USER, value)
        setUser(value)
    }

    return {value: user, change, generate: () => change(generateName())}
}
