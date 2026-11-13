const KEY_SESSION = 'session'

/**
 * Random id per browser, kept across reloads. Joining a room again with the same session (e.g., after a lost
 * connection or a reload) takes over the existing user including their vote.
 */
export function getSession(): string {
    const found = window.localStorage.getItem(KEY_SESSION)
    if (found) return found

    const generated = generate()
    window.localStorage.setItem(KEY_SESSION, generated)
    return generated
}

function generate() {
    // randomUUID is only available in secure contexts (https, localhost)
    if (window.crypto?.randomUUID) return window.crypto.randomUUID()
    const bytes = window.crypto.getRandomValues(new Uint8Array(16))
    return Array.from(bytes, it => it.toString(16).padStart(2, '0')).join('')
}
