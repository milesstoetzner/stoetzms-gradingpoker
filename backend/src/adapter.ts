import {createShardedAdapter} from '@socket.io/redis-adapter'
import * as config from './config'
import {connect} from './redis'

/**
 * With the Redis store, multiple servers can serve the same room. The Redis adapter forwards broadcasts, fetchSockets
 * and disconnectSockets to the sockets of a room on other servers via Redis sharded pub/sub (Redis 7 or newer).
 *
 * Every room has its own channel, and a server only subscribes to the rooms it has sockets in. Hence, a broadcast only
 * reaches the servers that serve the room, and in a Redis Cluster only the shard that owns the channel.
 */
export function loadAdapter() {
    if (config.store !== 'redis') return {adapter: undefined, close: async () => {}}

    const pub = connect()
    const sub = pub.duplicate()

    return {
        adapter: createShardedAdapter(pub as any, sub as any),
        close: async () => {
            await Promise.all([pub.quit(), sub.quit()])
        },
    }
}
