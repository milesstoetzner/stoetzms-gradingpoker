import * as config from '../config'
import {RedisStore} from './redis'
import {MemoryStore} from './memory'
import {Rooms} from './rooms'
import {RoomOperations} from './types'

export function load(): RoomOperations {
    switch (config.store) {
        case 'redis':
            return new Rooms(new RedisStore(config.roomTtl), config.offlineGrace)
        case 'memory':
            return new Rooms(new MemoryStore(config.roomTtl), config.offlineGrace)
        default:
            throw new Error(`Unknown store: ${config.store}`)
    }
}
