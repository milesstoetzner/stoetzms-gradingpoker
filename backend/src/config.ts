export const debug = process.env.NODE_ENV !== 'production'
export const origin = process.env.STOETZMS_GRADING_POKER_ORIGIN ?? '*'
export const path = process.env.STOETZMS_GRADING_POKER_PATH ?? '/socket.io'
export const port = Number(process.env.STOETZMS_GRADING_POKER_PORT ?? 3000)
export const persistency = process.env.STOETZMS_GRADING_POKER_PERSISTENCY ?? 'memory'
export const redis = process.env.STOETZMS_GRADING_POKER_REDIS_HOST ?? 'redis'
export const redisPort = Number(process.env.STOETZMS_GRADING_POKER_REDIS_PORT ?? 6379)
// Allow seeding new rooms with fake users (?seed); off in production unless enabled explicitly
export const seed = (process.env.STOETZMS_GRADING_POKER_SEED ?? String(debug)) === 'true'
