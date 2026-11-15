import * as React from 'react'

import {cn} from '../../lib/utils'

/**
 * Joins buttons (and inputs) into one control: no gaps, shared borders, rounded only at the outer corners.
 */
export function ButtonGroup({className, ...props}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            role="group"
            className={cn(
                'flex items-stretch [&>*]:rounded-none [&>*:first-child]:rounded-l-md [&>*:last-child]:rounded-r-md [&>*:not(:first-child)]:-ml-px [&>*:focus-visible]:relative [&>*:focus-visible]:z-10',
                className
            )}
            {...props}
        />
    )
}
