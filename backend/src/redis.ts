import Redis, {Cluster} from 'ioredis'
import * as config from './config'

export type Connection = Redis | Cluster

/**
 * Connects to a single Redis or, if configured, to a Redis Cluster.
 *
 * With a cluster, the configured host and port are those of any node (e.g., a service in front of all nodes). The
 * client learns the other nodes from it, sends every key to the node that owns it and follows failovers.
 */
export function connect(): Connection {
    if (!config.redisCluster) return new Redis({host: config.redis, port: config.redisPort, password: config.redisPassword})

    return new Cluster([{host: config.redis, port: config.redisPort}], {
        // Required for the sharded pub/sub of the socket.io adapter: one subscriber connection per shard
        shardedSubscribers: true,
        redisOptions: {password: config.redisPassword},
    })
}
