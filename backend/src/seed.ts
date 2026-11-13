import {generateAvatar} from './utils'
import randomName from '@scaleway/random-name'

export function generateSeed() {
    const hidden = true

    const users = [
        {
            name: randomName(),
            avatar: generateAvatar(),
            online: true,
        },
        {
            name: randomName(),
            avatar: generateAvatar(),
            online: true,
        },
        {
            name: randomName(),
            avatar: generateAvatar(),
            online: true,
        },
        {
            name: randomName(),
            avatar: generateAvatar(),
            online: true,
        },
    ]

    const votes = {
        [users[0].name]: '1.0',
        [users[1].name]: '2.0',
        [users[3].name]: 'Withhold',
    }

    const voted = Object.fromEntries(
        Object.keys(votes).map(name => [name, true])
    )

    return {hidden, users, votes, voted}
}
