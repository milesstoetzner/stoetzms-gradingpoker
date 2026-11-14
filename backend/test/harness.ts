import {ChildProcess, spawn} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import {createServer} from 'node:net'
import {io, Socket} from 'socket.io-client'
import {ClientToServerEvents, Notification, RoomEvent, RoomState, ServerEvents, ServerToClientEvents} from '../../spec/types'
import {RoomSync} from '../../spec/sync'

export type Client = Socket<ServerToClientEvents, ClientToServerEvents> & {
    notifications: string[]
    // Per browser, reused when reconnecting
    session: string
    // Room state, kept up to date like the frontend does (full states and events)
    readonly state?: RoomState
    // Events received so far
    events: RoomEvent[]
}

// The tests need a Redis (TEST_REDIS_HOST and TEST_REDIS_PORT, by default localhost:6379)
export const REDIS = {host: process.env.TEST_REDIS_HOST ?? 'localhost', port: process.env.TEST_REDIS_PORT ?? '6379'}

export const OFFLINE_GRACE = 2
// Seconds between heartbeats, which also remove offline users after their grace period
export const HEARTBEAT = 1

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

    constructor(private readonly env: Record<string, string> = {}) {}

    async start() {
        this.port = await freePort()
        // Started as a single node process (not via npx), so that signals reach the server itself on every platform
        this.process = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
            cwd: new URL('..', import.meta.url).pathname,
            env: {
                ...process.env,
                NODE_ENV: 'test',
                STOETZMS_GRADING_POKER_PORT: String(this.port),
                STOETZMS_GRADING_POKER_REDIS_HOST: REDIS.host,
                STOETZMS_GRADING_POKER_REDIS_PORT: REDIS.port,
                STOETZMS_GRADING_POKER_OFFLINE_GRACE: String(OFFLINE_GRACE),
                STOETZMS_GRADING_POKER_HEARTBEAT: String(HEARTBEAT),
                ...this.env,
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

    client(session: string = randomUUID()): Client {
        const client = io(`http://localhost:${this.port}`, {
            path: '/socket.io',
            transports: ['websocket'],
            forceNew: true,
            reconnection: false,
        }) as Client
        client.notifications = []
        client.session = session
        client.events = []
        const sync = new RoomSync()
        Object.defineProperty(client, 'state', {get: () => sync.state})
        const resync = () => client.emit('init-state' as any, () => {})
        client.on(ServerEvents.ROOM_STATE, (data: RoomState) => {
            if (sync.snapshot(data)) resync()
        })
        client.on(ServerEvents.ROOM_EVENT, (event: RoomEvent) => {
            client.events.push(event)
            if (sync.event(event) === 'resync') resync()
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
        await this.kill()
    }

    // Stops the server gracefully (SIGTERM) without disconnecting its clients first
    async kill() {
        const exited = new Promise(resolve => this.process?.once('exit', resolve))
        this.process?.kill('SIGTERM')
        await exited
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
    return client.timeout(1000).emitWithAck('join-room' as any, {room, user, session: client.session})
}

// Simulates a lost connection (e.g., network, phone locked) without telling the server
export async function drop(client: Client) {
    const disconnected = new Promise(resolve => client.once('disconnect', resolve))
    client.io.engine.close()
    await disconnected
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
