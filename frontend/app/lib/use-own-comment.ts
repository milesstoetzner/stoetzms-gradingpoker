import React from 'react'
import {useDebouncedCallback} from 'use-debounce'

// A comment is saved once the user paused typing
const SAVE_DELAY_MILLISECONDS = 800

/**
 * The own comment: a draft which is saved while typing.
 *
 * save: sends the comment to the server and calls onSaved once the server confirmed it.
 */
export function useOwnComment(save: (comment: string, onSaved: () => void) => void) {
    const [draft, setDraft] = React.useState('')
    // The latest draft, the comment confirmed by the server and whether the draft has unsaved changes
    const latest = React.useRef('')
    const saved = React.useRef('')
    const changed = React.useRef(false)

    const saveLater = useDebouncedCallback((comment: string) => {
        save(comment, () => {
            saved.current = comment
            // Further edits meanwhile are saved by the next call
            if (comment === latest.current) changed.current = false
        })
    }, SAVE_DELAY_MILLISECONDS)

    return {
        value: draft,

        change(comment: string) {
            setDraft(comment)
            latest.current = comment
            changed.current = true
            saveLater(comment)
        },

        // Saves a pending draft right away
        flush: () => saveLater.flush(),

        // Takes over the comment stored on the server, unless there are unsaved edits
        load(stored: string) {
            saved.current = stored
            if (!changed.current) setDraft(stored)
        },
    }
}
