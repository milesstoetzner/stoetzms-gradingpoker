import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "~/components/ui/tooltip";
import {Button} from "~/components/ui/button";
import {Share2} from "lucide-react";
import React from "react";
import copy from "copy-to-clipboard";
import {toast} from "sonner";


export default function Share() {

    function share() {
        copy(window.location.href)
        toast("Copied link to clipboard!")
    }

    return (<TooltipProvider>
        <Tooltip>
            <TooltipTrigger asChild>
                <Button variant="outline" className="size-8" onClick={share} >
                    <Share2 />
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                Copy Link
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>)
}