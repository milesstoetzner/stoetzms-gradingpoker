import {Button} from '../ui/button'
import {Share2} from 'lucide-react'
import React from 'react'
import copy from 'copy-to-clipboard'
import {toast} from 'sonner'
import Hover from './hover'

export default function Share() {
    function share() {
        copy(window.location.href)
        toast('Link copied ...')
    }

    return (
        <Hover message="Copy Link">
            <Button variant="outline" className="size-8" onClick={share}>
                <Share2 />
            </Button>
        </Hover>
    )
}
