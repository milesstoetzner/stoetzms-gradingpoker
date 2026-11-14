export const debug = process.env.NODE_ENV !== 'production'
// Origin allowed to connect from another site (CORS). Not needed if frontend and backend share one origin
export const origin = process.env.STOETZMS_GRADING_POKER_ORIGIN || undefined
export const path = process.env.STOETZMS_GRADING_POKER_PATH ?? '/socket.io'
export const port = Number(process.env.STOETZMS_GRADING_POKER_PORT ?? 3000)
export const redis = process.env.STOETZMS_GRADING_POKER_REDIS_HOST ?? 'localhost'
export const redisPort = Number(process.env.STOETZMS_GRADING_POKER_REDIS_PORT ?? 6379)
export const redisPassword = process.env.STOETZMS_GRADING_POKER_REDIS_PASSWORD || undefined
// Whether Redis is a Redis Cluster. If so, the Redis host and port are those of any of its nodes
export const redisCluster = process.env.STOETZMS_GRADING_POKER_REDIS_CLUSTER === 'true'
// Allow seeding new rooms with fake users (?seed); off in production unless enabled explicitly
export const seed = (process.env.STOETZMS_GRADING_POKER_SEED ?? String(debug)) === 'true'
// Seconds an offline user (lost connection) keeps their seat and vote before being removed
export const offlineGrace = Number(process.env.STOETZMS_GRADING_POKER_OFFLINE_GRACE ?? 600)
// Seconds after the last change of a room until it is deleted
export const roomTtl = Number(process.env.STOETZMS_GRADING_POKER_ROOM_TTL ?? 7 * 24 * 60 * 60)
// Seconds between heartbeats, which tell clients the current version of their room and remove expired offline users
export const heartbeat = Number(process.env.STOETZMS_GRADING_POKER_HEARTBEAT ?? 5)
