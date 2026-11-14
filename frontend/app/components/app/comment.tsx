import React from 'react'
import {Check, MessageSquareText} from 'lucide-react'
import {Textarea} from '../ui/textarea'
import {Label} from '../ui/label'
import {COMMENT_MAX_LENGTH} from '../../../../spec/types'

/**
 * Own anonymous comment. Saved automatically (debounced by the caller), editable only while votes are hidden.
 */
export default function Comment(props: {
    value: string
    onChange: (value: string) => void
    saving: boolean
    saved: boolean
    locked: boolean
    disabled: boolean
}) {
    return (
        <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
                <Label htmlFor="comment" className="flex items-center gap-2">
                    <MessageSquareText className="size-4" /> Anonymous comment
                </Label>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {props.saving ? (
                        'Saving ...'
                    ) : props.saved && props.value ? (
                        <React.Fragment>
                            <Check className="size-3" /> Saved
                        </React.Fragment>
                    ) : null}
                </span>
            </div>
            <Textarea
                id="comment"
                value={props.value}
                onChange={e => props.onChange(e.target.value)}
                maxLength={COMMENT_MAX_LENGTH}
                disabled={props.disabled || props.locked}
                placeholder={
                    props.locked
                        ? 'Comments can only be changed while votes are hidden ...'
                        : 'Shown without your name once votes are revealed ...'
                }
                rows={2}
            />
        </div>
    )
}
