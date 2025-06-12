import {generateAvatar} from './utils'
import randomName from '@scaleway/random-name'

export function generateSeed() {
    const users = [
        {
            name: randomName(),
            avatar: generateAvatar(),
        },
        {
            name: randomName(),
            avatar: generateAvatar(),
        },
        {
            name: randomName(),
            avatar: generateAvatar(),
        },
        {
            name: randomName(),
            avatar: generateAvatar(),
        },
    ]

    const votes = {
        [users[0].name]: '1.0',
        [users[1].name]: '2.0',
        [users[3].name]: 'Withhold',
    }

    return {users, votes}
}
