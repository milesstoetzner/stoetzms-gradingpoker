import {Spade} from 'lucide-react'
import {cn} from '../../lib/utils'

export function Logo(props: {className?: string; text?: boolean}) {
    return (
        <span className={cn('inline-flex items-center gap-2', props.className)}>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Spade className="size-5" />
            </span>
            {props.text && <span className="font-semibold tracking-tight">gradingpoker</span>}
        </span>
    )
}
