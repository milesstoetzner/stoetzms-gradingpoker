export const debug = process.env.NODE_ENV !== 'production'
export const origin = process.env.STOETZMS_GRADING_POKER_ORIGIN ?? '*'
export const path = process.env.STOETZMS_GRADING_POKER_PATH ?? '/socket.io'
export const port = Number(process.env.STOETZMS_GRADING_POKER_PORT ?? 3000)
export const persistency = process.env.STOETZMS_GRADING_POKER_PERSISTENCY ?? 'memory'
export const redis = process.env.STOETZMS_GRADING_POKER_REDIS_HOST ?? 'redis'
export const redisPort = Number(process.env.STOETZMS_GRADING_POKER_REDIS_PORT ?? 6379)
export const redisPassword = process.env.STOETZMS_GRADING_POKER_REDIS_PASSWORD || undefined
// Name of the Redis master monitored by Redis Sentinel. If set, the Redis host and port are those of the Sentinels
export const redisSentinel = process.env.STOETZMS_GRADING_POKER_REDIS_SENTINEL || undefined
// Allow seeding new rooms with fake users (?seed); off in production unless enabled explicitly
export const seed = (process.env.STOETZMS_GRADING_POKER_SEED ?? String(debug)) === 'true'
// Seconds an offline user (lost connection) keeps their seat and vote before being removed
export const offlineGrace = Number(process.env.STOETZMS_GRADING_POKER_OFFLINE_GRACE ?? 600)
// Seconds after the last change of a room until it is deleted
export const roomTtl = Number(process.env.STOETZMS_GRADING_POKER_ROOM_TTL ?? 7 * 24 * 60 * 60)
