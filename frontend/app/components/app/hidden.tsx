import {EyeOff} from 'lucide-react'
import {Button} from '../ui/button'

export default function Hidden() {
    return (
        <Button className="w-full cursor-default hover:bg-black sm:w-[180px]">
            <EyeOff /> Hidden
        </Button>
    )
}
