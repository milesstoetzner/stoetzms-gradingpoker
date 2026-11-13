import {createAdapter} from '@socket.io/redis-adapter'
import Redis from 'ioredis'
import * as config from './config'

/**
 * With Redis persistency, multiple servers can serve the same room. The Redis adapter forwards broadcasts, fetchSockets
 * and disconnectSockets to the sockets of a room on all servers via Redis pub/sub.
 */
export function loadAdapter() {
    if (config.persistency !== 'redis') return {adapter: undefined, close: async () => {}}

    const pub = new Redis({host: config.redis, port: config.redisPort})
    const sub = pub.duplicate()

    return {
        adapter: createAdapter(pub, sub),
        close: async () => {
            await Promise.all([pub.quit(), sub.quit()])
        },
    }
}
