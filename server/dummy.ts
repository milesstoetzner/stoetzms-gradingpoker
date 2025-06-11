import {generateAvatar} from "./utils"

export function DummyUsers() {
    return [
        {
            name: 'magical-nightingale',
            avatar: generateAvatar(),
        },
        {
            name: 'zealous-goldberg',
            avatar: generateAvatar(),
        },
        {
            name: 'amazing-brahmagupta',
            avatar: generateAvatar(),
        },
        {
            name: 'vibrant-knuth',
            avatar: generateAvatar(),
        }]
}

export function DummyVotes() {
    return {
        'magical-nightingale': '1.0',
        'amazing-brahmagupta': '2.0',
        'vibrant-knuth': 'baum',
    }
}

