import * as z from 'zod/v4'
import {Ack, BALLOT_VALUES, JoinRoom, RemoveUser, SetVote, validateName} from '../../spec/types'

const _name = z
    .string()
    .trim()
    .superRefine((it, ctx) => {
        const error = validateName(it)
        if (error) ctx.addIssue({code: 'custom', message: error})
    })

const _joinRoom = z.object({
    room: _name,
    user: _name,
    session: z.string().regex(/^[A-Za-z0-9-]{16,64}$/, 'Invalid session'),
    seed: z.boolean().optional(),
})

export function joinRoom(input: any): JoinRoom {
    return _joinRoom.parse(input)
}

const _setVote = z.object({
    vote: z.string().refine(it => BALLOT_VALUES.includes(it), 'Unknown vote'),
})

export function setVote(input: any): SetVote {
    return _setVote.parse(input)
}

const _removeUser = z.object({
    user: _name,
})

export function removeUser(input: any): RemoveUser {
    return _removeUser.parse(input)
}

export function ack(input: any): input is Ack {
    if (typeof input !== 'function') throw new Error(`${input} is not a function`)
    return true
}

export function isInvalidInput(error: unknown): error is z.ZodError {
    return error instanceof z.ZodError
}
