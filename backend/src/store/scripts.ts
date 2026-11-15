/**
 * The rules of a room, one Lua script per operation. Redis runs a script atomically, also across all servers, so an
 * operation never reads a room, changes it and writes it back: it changes the few fields it is about in one step.
 *
 * A room is stored in four hashes, which share one slot of a Redis Cluster (hash tag {name}):
 *
 * - KEYS[1] room:{name}           id, version, hidden (1 or 0), seq (counter for the join order)
 * - KEYS[2] room:{name}:users     name -> json {session, socket, seq, offline?}
 * - KEYS[3] room:{name}:votes     name -> vote
 * - KEYS[4] room:{name}:comments  name -> comment
 * - KEYS[5] room:{name}:events    channel (sharded pub/sub) the changes are published to
 *
 * Every change increases the version and publishes an event with that version in the same step, so a change and its
 * notification cannot be separated. ARGV[1] is always the seconds after which a room without changes expires.
 */
const PRELUDE = `
local meta, users, votes, comments, channel = KEYS[1], KEYS[2], KEYS[3], KEYS[4], KEYS[5]
local ttl = tonumber(ARGV[1])

local function exists()
    return redis.call('EXISTS', meta) == 1
end

local function touch()
    for i = 1, 4 do redis.call('EXPIRE', KEYS[i], ttl) end
end

local function hidden()
    return redis.call('HGET', meta, 'hidden') == '1'
end

-- Comments sorted by content: the order of joining or writing would reveal who wrote them
local function sorted()
    local list = redis.call('HVALS', comments)
    table.sort(list)
    return list
end

-- Counts the change, publishes it and keeps the room alive
local function publish(event)
    event.id = redis.call('HGET', meta, 'id')
    event.version = redis.call('HINCRBY', meta, 'version', 1)
    redis.call('SPUBLISH', channel, cjson.encode(event))
    touch()
    return event.version
end

-- Hides the votes, as part of a change that is published anyway
local function hide()
    redis.call('HSET', meta, 'hidden', '1')
end

local function remove(user, by)
    if redis.call('HDEL', users, user) == 0 then return false end
    redis.call('HDEL', votes, user)
    redis.call('HDEL', comments, user)
    local event = {type = 'left', user = user}
    if by and by ~= '' then event.by = by end
    -- While votes are shown, the comment of the user disappears from the result as well
    if not hidden() then event.comments = sorted() end
    publish(event)
    return true
end
`

/**
 * ARGV: ttl, user, session, socket, new room id, seed (json {hidden, users: [name], votes: {name: vote}} or empty)
 * Returns: collision | takeover | joined
 */
export const JOIN = `${PRELUDE}
local user, session, socket = ARGV[2], ARGV[3], ARGV[4]

if not exists() then
    redis.call('HSET', meta, 'id', ARGV[5], 'version', 0, 'hidden', '1', 'seq', 0)
    if ARGV[6] ~= '' then
        local seed = cjson.decode(ARGV[6])
        redis.call('HSET', meta, 'hidden', seed.hidden and '1' or '0')
        for _, name in ipairs(seed.users) do
            local seq = redis.call('HINCRBY', meta, 'seq', 1)
            redis.call('HSET', users, name, cjson.encode({session = '', socket = '', seq = seq}))
        end
        for name, vote in pairs(seed.votes) do redis.call('HSET', votes, name, vote) end
    end
end

-- Take over the existing user (e.g., reconnect), which keeps their vote
local raw = redis.call('HGET', users, user)
if raw then
    local existing = cjson.decode(raw)
    if existing.session ~= session then return 'collision' end
    existing.socket = socket
    existing.offline = nil
    redis.call('HSET', users, user, cjson.encode(existing))
    publish({type = 'takeover', user = user, socket = socket})
    return 'takeover'
end

local seq = redis.call('HINCRBY', meta, 'seq', 1)
redis.call('HSET', users, user, cjson.encode({session = session, socket = socket, seq = seq}))
hide()
publish({type = 'joined', user = user, seq = seq})
return 'joined'
`

/**
 * Removes the user, their vote and their comment.
 *
 * ARGV: ttl, user, removed by (or empty)
 * Returns: gone | ok
 */
export const LEAVE = `${PRELUDE}
if not exists() then return 'gone' end
remove(ARGV[2], ARGV[3])
return 'ok'
`

/**
 * Removes the user (leave) or marks them as offline, but only if the socket is still the user's current one.
 *
 * ARGV: ttl, user, socket, mode (leave | offline), now (epoch seconds)
 */
export const DISCONNECT = `${PRELUDE}
local user, socket, mode = ARGV[2], ARGV[3], ARGV[4]
if not exists() then return 'gone' end

local raw = redis.call('HGET', users, user)
if not raw then return 'ok' end
local existing = cjson.decode(raw)
if existing.socket ~= socket then return 'ok' end

if mode == 'leave' then
    remove(user)
else
    existing.offline = tonumber(ARGV[5])
    redis.call('HSET', users, user, cjson.encode(existing))
    publish({type = 'offline', user = user})
end
return 'ok'
`

/**
 * ARGV: ttl, user, vote
 * Returns: gone (also if the user is not in the room) | ok
 */
export const VOTE = `${PRELUDE}
local user = ARGV[2]
if not exists() or redis.call('HEXISTS', users, user) == 0 then return 'gone' end

redis.call('HSET', votes, user, ARGV[3])
hide()
publish({type = 'voted', user = user})
return 'ok'
`

/**
 * Sets or removes (empty) the comment of the user, only while votes are hidden. Nothing is published: nobody may
 * learn that someone commented.
 *
 * ARGV: ttl, user, comment
 * Returns: gone | shown | ok
 */
export const COMMENT = `${PRELUDE}
local user, comment = ARGV[2], ARGV[3]
if not exists() or redis.call('HEXISTS', users, user) == 0 then return 'gone' end
if not hidden() then return 'shown' end

if comment == '' then redis.call('HDEL', comments, user) else redis.call('HSET', comments, user, comment) end
touch()
return 'ok'
`

/**
 * Shows or hides the votes. Showing publishes all votes and comments.
 *
 * ARGV: ttl, hidden (1 | 0), user who did it
 * Returns: gone | ok
 */
export const SET_HIDDEN = `${PRELUDE}
if not exists() then return 'gone' end
if redis.call('HGET', meta, 'hidden') == ARGV[2] then return 'ok' end

redis.call('HSET', meta, 'hidden', ARGV[2])
if ARGV[2] == '1' then
    publish({type = 'hidden', by = ARGV[3]})
else
    local flat = redis.call('HGETALL', votes)
    local all = {}
    for i = 1, #flat, 2 do all[flat[i]] = flat[i + 1] end
    publish({type = 'shown', votes = all, comments = sorted(), by = ARGV[3]})
end
return 'ok'
`

/**
 * Deletes the room and tells everyone.
 */
export const CLOSE = `${PRELUDE}
if not exists() then return 'gone' end
local id = redis.call('HGET', meta, 'id')
redis.call('DEL', meta, users, votes, comments)
redis.call('SPUBLISH', channel, cjson.encode({type = 'closed', id = id}))
return 'ok'
`

/**
 * Housekeeping without keeping the room alive: removes offline users whose grace period ended.
 *
 * ARGV: ttl, now (epoch seconds), grace (seconds)
 * Returns: nil if the room is gone, otherwise {id, version}
 */
export const SYNC = `${PRELUDE}
if not exists() then return nil end

local now, grace = tonumber(ARGV[2]), tonumber(ARGV[3])
local flat = redis.call('HGETALL', users)
for i = 1, #flat, 2 do
    local user = cjson.decode(flat[i + 1])
    if user.offline and now - user.offline >= grace then remove(flat[i]) end
end

return {redis.call('HGET', meta, 'id'), redis.call('HGET', meta, 'version')}
`

/**
 * Returns: nil if the room is gone, otherwise the four hashes {meta, users, votes, comments} as flat lists
 */
export const SNAPSHOT = `${PRELUDE}
if not exists() then return nil end
return {redis.call('HGETALL', meta), redis.call('HGETALL', users), redis.call('HGETALL', votes), redis.call('HGETALL', comments)}
`
