import * as config from '../config'
import {PersistencyRedis} from "./redis";
import {PersistencyMemory} from "./memory";
import {Persistency} from "./types";

export function load(): Persistency {
    switch (config.persistency) {
        case 'redis':
            return new PersistencyRedis()
        case 'memory':
            return new PersistencyMemory()
        default:
            throw new Error(`Unknown persistency type: ${config.persistency}`)
    }
}
