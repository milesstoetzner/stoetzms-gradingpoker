import {createAdapter} from '@socket.io/redis-adapter'
import * as config from './config'
import {connect} from './redis'

/**
 * With the Redis store, multiple servers can serve the same room. The Redis adapter forwards broadcasts, fetchSockets
 * and disconnectSockets to the sockets of a room on all servers via Redis pub/sub.
 */
export function loadAdapter() {
    if (config.store !== 'redis') return {adapter: undefined, close: async () => {}}

    const pub = connect()
    const sub = pub.duplicate()

    return {
        adapter: createAdapter(pub, sub),
        close: async () => {
            await Promise.all([pub.quit(), sub.quit()])
        },
    }
}
