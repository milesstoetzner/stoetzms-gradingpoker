import {RoomEvent, ServerEvents} from '../../spec/types'
import {Rooms} from './store/rooms'
import {StoreEvent} from './store/types'
import {AppServer} from './types'

/**
 * Forwards the changes of rooms to the sockets on this server.
 *
 * The server is subscribed to the events of exactly the rooms it has sockets in, so a change reaches the clients of
 * all servers without the servers knowing each other. Besides changes, events tell the server which of its sockets to
 * disconnect: those of a removed or taken over user and everyone in a closed room.
 */
export class Broadcast {
    // Rooms with sockets on this server
    private readonly local = new Map<string, {sockets: Set<string>; subscribed: Promise<void>}>()
    private timer?: NodeJS.Timeout

    constructor(
        private readonly io: AppServer,
        private readonly rooms: Rooms
    ) {}

    // Starts forwarding events and sending the heartbeat (interval in seconds)
    start(interval: number) {
        this.rooms.onEvent((room, event) => this.forward(room, event))

        // Events might have been missed while the subscription was interrupted
        this.rooms.onRestored(() => this.heartbeat().catch(console.log))

        this.timer = setInterval(() => this.heartbeat().catch(console.log), interval * 1000)
        this.timer.unref()
    }

    stop() {
        clearInterval(this.timer)
    }

    // Subscribes before the socket does anything in the room, so that no event is missed
    async enter(room: string, socket: string) {
        let entry = this.local.get(room)
        if (!entry) {
            entry = {sockets: new Set(), subscribed: this.rooms.subscribe(room)}
            this.local.set(room, entry)
        }
        entry.sockets.add(socket)
        await entry.subscribed
    }

    async exit(room: string, socket: string) {
        const entry = this.local.get(room)
        if (!entry) return
        entry.sockets.delete(socket)
        if (entry.sockets.size) return

        this.local.delete(room)
        await this.rooms.unsubscribe(room)
    }

    /**
     * Heartbeat: tells the clients of every room on this server the current version of their room, so that a client
     * which missed the last change notices it. Also removes offline users whose grace period ended.
     */
    private async heartbeat() {
        await Promise.allSettled(
            [...this.local.keys()].map(async room => {
                const current = await this.rooms.sync(room)
                if (!current) return this.close(room)
                this.io.to(room).emit(ServerEvents.ROOM_EVENT, {type: 'version', ...current})
            })
        )
    }

    private forward(room: string, event: StoreEvent) {
        const {id} = event
        switch (event.type) {
            case 'closed':
                return this.close(room)

            case 'takeover':
                // Previous sockets of the user (e.g., another tab, stale connection)
                this.kick(room, event.user, 'You joined this room somewhere else ...', event.socket)
                return this.emit(room, {type: 'online', id, version: event.version, user: event.user})

            case 'left':
                if (event.by) this.kick(room, event.user, `You have been removed by ${event.by} ...`)
                return this.emit(room, {
                    type: 'left',
                    id,
                    version: event.version,
                    user: event.user,
                    ...(event.by ? {by: event.by} : {}),
                    ...(event.comments === undefined ? {} : {comments: toList(event.comments)}),
                })

            case 'joined':
                return this.emit(room, {type: 'joined', id, version: event.version, user: event.user})

            case 'shown':
                return this.emit(room, {
                    type: 'shown',
                    id,
                    version: event.version,
                    votes: event.votes,
                    comments: toList(event.comments),
                    ...(event.by ? {by: event.by} : {}),
                })

            default:
                return this.emit(room, event)
        }
    }

    private emit(room: string, event: RoomEvent) {
        console.log('server', room, 'emit', ServerEvents.ROOM_EVENT, event.type, event.version)
        this.io.to(room).emit(ServerEvents.ROOM_EVENT, event)
    }

    // Tells the sockets of the room on this server that it is closed and disconnects them
    private close(room: string) {
        console.log('server', room, 'emit', ServerEvents.CLOSE_ROOM)
        this.io.to(room).emit(ServerEvents.CLOSE_ROOM)
        this.io.in(room).disconnectSockets(true)
    }

    // Disconnects the sockets of a user on this server (except the given one)
    private kick(room: string, user: string, message: string, except?: string) {
        for (const id of this.io.sockets.adapter.rooms.get(room) ?? []) {
            const socket = this.io.sockets.sockets.get(id)
            if (!socket || socket.id === except || socket.data.user !== user) continue
            socket.emit(ServerEvents.SHOW_NOTIFICATION, {message})
            socket.disconnect(true)
        }
    }
}

// Redis encodes empty lists as objects
function toList(value: unknown): string[] {
    return Array.isArray(value) ? value : []
}
