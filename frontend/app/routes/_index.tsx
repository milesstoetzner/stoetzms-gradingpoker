import type {MetaFunction} from '@remix-run/node'
import {JoinCard} from '../components/app/join'
import React from 'react'
import {RoomCard} from '../components/app/room'
import {Toaster} from '../components/ui/sonner'
import {config} from '../lib/config'
import {useRoomName, useUserName} from '../lib/use-names'

export const meta: MetaFunction = () => {
    return [{title: 'gradingpoker.stoetz.ms'}, {name: 'description', content: 'Welcome to gradingpoker.stoetz.ms!'}]
}

const legalLinks = [
    {label: 'Impressum', href: config.impressumUrl},
    {label: 'Privacy', href: config.privacyUrl},
].filter((link): link is {label: string; href: string} => link.href !== undefined)

export default function Index() {
    const [process, setProcess] = React.useState<string>('JOIN')
    const room = useRoomName()
    const user = useUserName()

    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-3 sm:p-6 md:p-10">
            <Toaster position="top-right" expand={true} />

            {process === 'JOIN' ? (
                <div className="flex w-full max-w-sm flex-col gap-6">
                    <JoinCard
                        room={room.value}
                        onRoomChange={event => room.change(event.target.value)}
                        onRoomGenerate={room.generate}
                        user={user.value}
                        onUserChange={event => user.change(event.target.value)}
                        onUserGenerate={user.generate}
                        setProcess={setProcess}
                    />

                    <LegalLinks />
                </div>
            ) : null}

            {process === 'ROOM' ? (
                <div className="flex w-full max-w-6xl flex-col gap-6">
                    <RoomCard room={room.value.trim()} user={user.value.trim()} setProcess={setProcess} />
                </div>
            ) : null}
        </div>
    )
}

// Links to the Impressum and the privacy policy, if configured
function LegalLinks() {
    if (!legalLinks.length) return null

    return (
        <div className="flex justify-center gap-2 text-sm text-neutral-500 mt-[-1rem]">
            {legalLinks.map((link, index) => (
                <React.Fragment key={link.href}>
                    {index > 0 ? <span aria-hidden="true">·</span> : null}
                    <a href={link.href} target="_blank" rel="noopener noreferrer">
                        {link.label}
                    </a>
                </React.Fragment>
            ))}
        </div>
    )
}
