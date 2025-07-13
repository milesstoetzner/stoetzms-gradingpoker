import {EyeOff} from 'lucide-react'
import {Button} from '../ui/button'
import React from 'react'

export default function Hidden() {
    return (
        <Button className="w-[180px] cursor-default hover:bg-black">
            <EyeOff /> Hidden
        </Button>
    )
}
