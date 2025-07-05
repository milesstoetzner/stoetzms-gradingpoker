export const debug = process.env.NODE_ENV !== 'production'
export const origin = process.env.STOETZMS_GRADING_POKER_ORIGIN ?? '*'
export const path = process.env.STOETZMS_GRADING_POKER_PATH ?? '/socket.io'
export const port = Number(process.env.STOETZMS_GRADING_POKER_PORT ?? 3000)
export const redis = process.env.STOETZMS_GRADING_POKER_REDIS_HOST ?? 'redis'
