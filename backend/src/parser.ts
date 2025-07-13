import * as z from "zod/v4";
import {Ack, JoinRoom, RemoveUser, SetVote} from "../../spec/types";

const _joinRoom = z.object({
    room:  z.string(),
    user: z.string(),
    seed: z.boolean().optional()
})

export function joinRoom(input: any): JoinRoom {
    return _joinRoom.parse(input)
}

const _setVote = z.object({
    vote: z.string(),
})

export function setVote(input: any): SetVote {
    return _setVote.parse(input)
}

const _removeUser = z.object({
    user: z.string(),
})

export function removeUser(input: any): RemoveUser {
    return _removeUser.parse(input)
}

export function ack(input: any): input is Ack {
    if (typeof input !== "function") throw new Error(`${input} is not a function`)
    return true
}