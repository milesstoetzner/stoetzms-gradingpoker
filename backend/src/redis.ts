import Redis, {RedisOptions} from 'ioredis'
import * as config from './config'

/**
 * Connects to Redis, directly or through Redis Sentinel.
 *
 * With Sentinel, the configured host and port are those of the Sentinels, which are asked for the current master on
 * every (re)connect, so that a connection follows a failover.
 */
export function connect(): Redis {
    return new Redis(options())
}

export function options(): RedisOptions {
    if (!config.redisSentinel) return {host: config.redis, port: config.redisPort, password: config.redisPassword}

    return {
        sentinels: [{host: config.redis, port: config.redisPort}],
        name: config.redisSentinel,
        password: config.redisPassword,
        sentinelPassword: config.redisPassword,
        // A master that was demoted while we are still connected rejects writes: ask the Sentinels again and resend
        reconnectOnError: error => (error.message.startsWith('READONLY') ? 2 : false),
    }
}
