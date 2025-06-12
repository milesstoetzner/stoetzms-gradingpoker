import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "../ui/tooltip";
import React from "react";

export default function Hover(props: { children: React.ReactNode, message: string }) {
    return <TooltipProvider delayDuration={0}>
        <Tooltip>
            <TooltipTrigger asChild>
                {props.children}
            </TooltipTrigger>
            <TooltipContent>
                {props.message}
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
}