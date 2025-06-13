export const debug = process.env.NODE_ENV !== 'production'
export const origin = process.env.STOETZMS_PLANNING_POKER_ORIGIN ?? '*'
export const path = process.env.STOETZMS_PLANNING_POKER_PATH ?? '/socket.io'
export const port = process.env.STOETZMS_PLANNING_PORT ?? 3000
