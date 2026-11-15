import {RateLimiter} from 'limiter'
import {Ack, ClientEvents, HIDDEN, ServerEvents} from '../../spec/types'
import * as config from './config'
import {TooManyRequests} from './errors'
import * as parser from './parser'
import {toState} from './state'
import {Rooms} from './store/rooms'
import {RoomGone} from './store/types'
import {AppSocket, Me} from './types'

// Requests a client may send per window
const REQUESTS_PER_WINDOW = 30
const WINDOW_MILLISECONDS = 30_000

// Returning false means that the handler answered the client itself, so no ack is sent
type Handler<Args extends unknown[]> = (...args: Args) => Promise<boolean | void>

/**
 * A connected client: receives its requests and answers them.
 */
export class Client {
    private readonly limiter = new RateLimiter({
        tokensPerInterval: REQUESTS_PER_WINDOW,
        interval: WINDOW_MILLISECONDS,
        fireImmediately: true,
    })

    constructor(
        readonly socket: AppSocket,
        private readonly rooms: Rooms
    ) {
        socket.data = {ok: false, id: socket.id}
    }

    /**
     * Registers a handler for a request. The request is logged, rate limited and acked (unless the handler returns
     * false). Errors (e.g., invalid input) are reported to the client.
     */
    on(event: ClientEvents, handler: Handler<[input: unknown]>) {
        // The handlers are registered by event name, which the typed socket does not allow
        const untyped = this.socket as unknown as {on(event: string, listener: (...args: unknown[]) => void): void}
        untyped.on(event, async (...args: unknown[]) => {
            const ack = args[args.length - 1] as Ack
            const input = args.length > 1 ? args[0] : undefined

            try {
                this.log('on', event, config.debug ? input : HIDDEN)
                parser.ack(ack)
                if (!this.limiter.tryRemoveTokens(1)) throw new TooManyRequests()

                const handled = await handler(input)
                if (handled !== false) ack({ok: true})
            } catch (e) {
                this.handleError(e)
            }
        })
    }

    // Same as on, but only for clients which joined a room
    onJoined(event: ClientEvents, handler: Handler<[input: unknown, me: Me]>) {
        this.on(event, async input => {
            const {data} = this.socket
            if (!data.ok) {
                this.socket.disconnect(true)
                return false
            }

            return handler(input, {room: data.room, user: data.user})
        })
    }

    // Sends the full state of the room to the client (including its own vote and comment)
    async emitOwnState(me: Me) {
        const state = toState(await this.rooms.getRoom(me.room), me.user)
        this.log('emit', ServerEvents.ROOM_STATE, config.debug ? state : HIDDEN)
        this.socket.emit(ServerEvents.ROOM_STATE, state)
    }

    emitError(message: string, ack?: Ack) {
        const notification = {message}
        this.log('emit', ServerEvents.SHOW_NOTIFICATION, config.debug ? notification : HIDDEN)
        this.socket.emit(ServerEvents.SHOW_NOTIFICATION, notification, ack)
    }

    handleError(error: unknown) {
        if (error instanceof TooManyRequests) return this.emitError(error.message)
        if (error instanceof RoomGone) return this.emitRoomGone()
        if (parser.isInvalidInput(error)) {
            const issue = error.issues[0]
            return this.emitError(`Invalid ${issue?.path.join('.') || 'input'}: ${issue?.message ?? 'unknown'}`)
        }

        console.log(error)
        if (this.socket.connected) this.emitError('Unexpected error on the server ...')
    }

    log(...message: unknown[]) {
        console.log('socket', this.socket.id, this.socket.data.room, ...message)
    }

    private emitRoomGone() {
        this.log('emit', ServerEvents.CLOSE_ROOM)
        this.socket.emit(ServerEvents.CLOSE_ROOM)
        this.socket.disconnect(true)
    }
}
