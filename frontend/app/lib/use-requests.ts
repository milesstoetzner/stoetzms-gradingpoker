import React from 'react'
import {Socket} from 'socket.io-client'
import {ClientEvents, HIDDEN, Response} from '../../../spec/types'

// Rate limited or failed requests are never acked
const ACK_TIMEOUT_MILLISECONDS = 5000

/**
 * Sends requests to the server and tracks which are still waiting for their ack, e.g., to prevent double submits.
 */
export function useRequests(socket: Socket, debug: boolean) {
    const [pending, setPending] = React.useState<Set<string>>(new Set())

    // key: identifies the request for isPending
    function request(key: string, event: ClientEvents, data?: unknown, onAck?: (response: Response) => void) {
        console.log('socket', socket.id, 'emit', event, debug ? data : HIDDEN)
        setPending(previous => new Set(previous).add(key))

        const done = (error: Error | null, response?: Response) => {
            console.log('socket', socket.id, 'ack', event, error ? error.message : response)
            setPending(previous => {
                const next = new Set(previous)
                next.delete(key)
                return next
            })
            if (response && onAck) onAck(response)
        }

        const emitter = socket.timeout(ACK_TIMEOUT_MILLISECONDS) as unknown as {
            emit(event: string, ...args: unknown[]): void
        }
        if (data === undefined) emitter.emit(event, done)
        else emitter.emit(event, data, done)
    }

    return {request, isPending: (key: string) => pending.has(key)}
}
