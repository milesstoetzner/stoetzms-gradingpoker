import * as config from '../config'
import {RedisStore} from './redis'
import {MemoryStore} from './memory'
import {Rooms} from './rooms'
import {Persistency} from './types'

export function load(): Persistency {
    switch (config.persistency) {
        case 'redis':
            return new Rooms(new RedisStore(), config.offlineGrace)
        case 'memory':
            return new Rooms(new MemoryStore(), config.offlineGrace)
        default:
            throw new Error(`Unknown persistency type: ${config.persistency}`)
    }
}
