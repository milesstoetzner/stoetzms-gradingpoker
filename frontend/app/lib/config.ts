export type RuntimeConfig = {
    impressumUrl?: string
    privacyUrl?: string
}

declare global {
    interface Window {
        __GRADINGPOKER_CONFIG__?: Partial<Record<keyof RuntimeConfig, unknown>>
    }
}

function read(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
}

function load(): RuntimeConfig {
    // Not available during the SPA build (prerendering runs in Node)
    if (typeof window === 'undefined') return {}
    const raw = window.__GRADINGPOKER_CONFIG__ ?? {}
    return {
        impressumUrl: read(raw.impressumUrl),
        privacyUrl: read(raw.privacyUrl),
    }
}

// Set by the classic <script src="/config.js"> in root.tsx, which runs before the app modules
export const config: RuntimeConfig = load()
