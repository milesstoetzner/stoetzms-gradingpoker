import {Server} from 'socket.io'
import {Broadcast} from './broadcast'
import {Client} from './client'
import * as config from './config'
import {registerHandlers} from './handlers'
import {createProbeServer} from './probes'
import {Rooms} from './store/rooms'
import {AppServer} from './types'

const rooms = new Rooms(config.roomTtl, config.offlineGrace)
await rooms.init()

// Not ready anymore once the server shuts down
let accepting = true
const http = createProbeServer(async () => accepting && (await rooms.health()))

const io: AppServer = new Server(http, {
    path: config.path,
    // WebSocket only: long-polling would require sticky sessions when running multiple servers
    transports: ['websocket'],
    cors: config.origin ? {origin: config.origin} : undefined,
    // Disconnects are not destructive (users go offline and keep their vote), so be lenient with mobile networks
    pingInterval: 10000,
    pingTimeout: 10000,
})

io.on('error', (error: Error) => {
    console.log('server', 'on', 'error', error)
})

const broadcast = new Broadcast(io, rooms)
broadcast.start(config.heartbeat)

const disconnecting = new Set<Promise<void>>()

io.on('connection', socket => {
    const client = new Client(socket, rooms)
    client.log('on', 'connected')
    registerHandlers(client, {rooms, broadcast, disconnecting})
})

http.listen(config.port)

process.on('unhandledRejection', error => {
    console.log(error)
})

async function shutdown(signal: string) {
    try {
        console.log('server', 'on', signal)
        accepting = false
        broadcast.stop()
        // Disconnected clients go offline and reconnect to another server, where they take over their user
        await io.close()
        await Promise.allSettled(disconnecting)
        await rooms.close()
        process.exit(0)
    } catch (e) {
        console.log(e)
        process.exit(1)
    }
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
