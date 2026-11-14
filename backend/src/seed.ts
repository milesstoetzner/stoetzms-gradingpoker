import randomName from '@scaleway/random-name'
import {Seed} from './store/types'

export function generateSeed(): Seed {
    const users = [randomName(), randomName(), randomName(), randomName()]

    return {
        hidden: true,
        users,
        votes: {
            [users[0]]: '1.0',
            [users[1]]: '2.0',
            [users[3]]: 'Withhold',
        },
    }
}
