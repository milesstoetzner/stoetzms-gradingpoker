import {Textarea} from '../ui/textarea'
import {Label} from '../ui/label'
import {COMMENT_MAX_LENGTH} from '../../../../spec/types'

/**
 * Own anonymous comment. Saved automatically (debounced by the caller), editable only while votes are hidden.
 */
export default function Comment(props: {
    value: string
    onChange: (value: string) => void
    locked: boolean
    disabled: boolean
}) {
    return (
        <div className="grid gap-2">
            <Label htmlFor="comment" className="text-muted-foreground">
                Anonymous Comment
            </Label>
            <Textarea
                id="comment"
                value={props.value}
                onChange={event => props.onChange(event.target.value)}
                maxLength={COMMENT_MAX_LENGTH}
                disabled={props.disabled || props.locked}
                placeholder="Share an anonymous comment once votes are revealed"
                rows={2}
            />
        </div>
    )
}
