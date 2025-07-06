import * as z from "zod/v4";
import {JoinRoom, SetVote} from "../../spec/types";

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