import {describe, expect, test} from 'vitest'
import {avatarData, avatarOf} from './avatar'

describe('avatar', () => {
    test('is the same for the same name', () => {
        expect(avatarOf('Anna Becker')).toBe(avatarOf('Anna Becker'))
        expect(avatarData('Anna Becker')).toEqual(avatarData('Anna Becker'))
    })

    test('differs between names', () => {
        const names = Array.from({length: 200}, (_, i) => `user ${i}`)
        expect(new Set(names.map(avatarOf)).size).toBeGreaterThan(190)
    })

    test('is a valid svg for any name', () => {
        for (const name of ['a', 'Jörg Müller', "O'Neil-Smith", '田中', 'x'.repeat(64)]) {
            expect(avatarOf(name)).toMatch(/^<svg .*<\/svg>$/)
            // Never empty
            expect(avatarOf(name)).toMatch(/ d="M/)
        }
    })
})
