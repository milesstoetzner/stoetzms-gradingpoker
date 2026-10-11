import {ChildProcess, spawn} from 'node:child_process'
import {createServer} from 'node:net'
import {io, Socket} from 'socket.io-client'
import {ClientToServerEvents, Notification, RoomState, ServerEvents, ServerToClientEvents} from '../../spec/types'

export type Client = Socket<ServerToClientEvents, ClientToServerEvents> & {
    notifications: string[]
    // Latest room state, applied like the frontend does (newer versions only)
    state?: RoomState
}

// Persistencies to test against: memory always, redis if TEST_REDIS_PORT is set
export const persistencies = ['memory', ...(process.env.TEST_REDIS_PORT ? ['redis'] : [])]

async function freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = createServer()
        server.unref()
        server.on('error', reject)
        server.listen(0, () => {
            const address = server.address()
            server.close(() => resolve(typeof address === 'object' && address ? address.port : 0))
        })
    })
}

export class TestServer {
    private process?: ChildProcess
    private clients: Client[] = []
    port = 0

    constructor(private readonly persistency: string) {}

    async start() {
        this.port = await freePort()
        this.process = spawn('npx', ['tsx', 'src/index.ts'], {
            cwd: new URL('..', import.meta.url).pathname,
            env: {
                ...process.env,
                NODE_ENV: 'test',
                STOETZMS_GRADING_POKER_PORT: String(this.port),
                STOETZMS_GRADING_POKER_PERSISTENCY: this.persistency,
                STOETZMS_GRADING_POKER_REDIS_HOST: process.env.TEST_REDIS_HOST ?? 'localhost',
                STOETZMS_GRADING_POKER_REDIS_PORT: process.env.TEST_REDIS_PORT ?? '6379',
            },
            stdio: process.env.TEST_SERVER_LOGS ? 'inherit' : 'ignore',
        })
        // Wait until the server accepts connections
        for (let i = 0; i < 100; i++) {
            const client = this.client()
            const ok = await new Promise<boolean>(resolve => {
                client.once('connect', () => resolve(true))
                client.once('connect_error', () => resolve(false))
            })
            client.disconnect()
            if (ok) return
            await sleep(100)
        }
        throw new Error('Server did not start')
    }

    client(): Client {
        const client = io(`http://localhost:${this.port}`, {
            path: '/socket.io',
            transports: ['websocket'],
            forceNew: true,
            reconnection: false,
        }) as Client
        client.notifications = []
        client.on(ServerEvents.ROOM_STATE, (data: RoomState) => {
            if (client.state && client.state.id === data.id && client.state.version > data.version) return
            client.state = data
        })
        client.on(ServerEvents.SHOW_NOTIFICATION, (data: Notification, ack) => {
            client.notifications.push(data.message)
            if (ack) ack({ok: true})
        })
        this.clients.push(client)
        return client
    }

    async stop() {
        this.clients.forEach(it => it.disconnect())
        this.process?.kill('SIGTERM')
        await new Promise(resolve => this.process?.once('exit', resolve))
    }
}

export async function connected(client: Client) {
    if (client.connected) return
    await new Promise<void>((resolve, reject) => {
        client.once('connect', () => resolve())
        client.once('connect_error', reject)
    })
}

export async function join(client: Client, room: string, user: string) {
    await connected(client)
    return client.timeout(1000).emitWithAck('join-room' as any, {room, user})
}

export async function ack(client: Client, event: string, ...args: unknown[]) {
    return (client.timeout(1000) as any).emitWithAck(event, ...args)
}

export function next<T = unknown>(client: Client, event: string, timeout = 1000): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeout)
        client.once(event as any, (data: T) => {
            clearTimeout(timer)
            resolve(data)
        })
    })
}

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export function unique(prefix: string) {
    return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

// Requests the current state from the server (as seen by the given client)
export async function fetchState(client: Client): Promise<RoomState> {
    // The server sends the requested state right before the ack, trailing broadcasts might arrive earlier
    let last: RoomState | undefined
    const listener = (data: RoomState) => (last = data)
    client.on(ServerEvents.ROOM_STATE, listener)
    await ack(client, 'init-state')
    client.off(ServerEvents.ROOM_STATE, listener)
    if (!last) throw new Error('No state received')
    return last
}
