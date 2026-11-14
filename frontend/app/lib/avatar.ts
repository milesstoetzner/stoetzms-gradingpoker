// Pixels per side: 2x2, as the avatars the server used to generate
const PIXELS = 2
const SIZE = 256

const cache = new Map<string, string>()

/**
 * Avatar of a user as SVG, derived from the name only. Hence, every client draws the same avatar for the same name
 * and the server neither generates, stores nor sends avatars.
 *
 * A pixel is drawn where the bit of its row differs from the bit of its column, in the color of its row.
 */
export function avatarOf(name: string): string {
    let avatar = cache.get(name)
    if (!avatar) {
        avatar = render(avatarData(name))
        cache.set(name, avatar)
    }
    return avatar
}

export type AvatarData = {columns: boolean[]; rows: boolean[]; colors: string[]}

export function avatarData(name: string): AvatarData {
    // At least one row is set, otherwise the avatar could be empty
    const rows = (hash(`${name}:rows`) % (2 ** PIXELS - 1)) + 1
    const columns = hash(`${name}:columns`) % 2 ** (PIXELS - 1)
    return {
        rows: bits(rows),
        columns: bits(columns),
        colors: Array.from({length: PIXELS}, (_, row) =>
            (hash(`${name}:color:${row}`) % 0xffffff).toString(16).padStart(6, '0')
        ),
    }
}

function render(data: AvatarData): string {
    const pixel = SIZE / PIXELS
    const paths = data.rows.map((row, y) => {
        const squares = data.columns
            .map((column, x) => (row !== column ? `M${x * pixel},${y * pixel} h${pixel} v${pixel} h${-pixel}Z` : ''))
            .filter(Boolean)
        return `<path fill="#${data.colors[y]}" d="${squares.join(' ')}"/>`
    })
    return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${SIZE} ${SIZE}">${paths.join('')}</svg>`
}

function bits(value: number): boolean[] {
    return value
        .toString(2)
        .padStart(PIXELS, '0')
        .split('')
        .map(it => it === '1')
}

// FNV-1a (32 bit) with a final mix, so that similar names differ in every part
function hash(value: string): number {
    let h = 0x811c9dc5
    for (let i = 0; i < value.length; i++) {
        h ^= value.charCodeAt(i)
        h = Math.imul(h, 0x01000193)
    }
    h ^= h >>> 16
    h = Math.imul(h, 0x85ebca6b)
    h ^= h >>> 13
    return h >>> 0
}
