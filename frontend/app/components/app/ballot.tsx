import {Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue} from '../ui/select'
import {BALLOT} from '../../../../spec/types'

export default function Ballot(props: {value: string; onChange: (value: string) => void; disabled: boolean}) {
    const groups = Object.entries(BALLOT)

    return (
        <Select value={props.value} onValueChange={props.onChange} disabled={props.disabled}>
            <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Still voting ..." />
            </SelectTrigger>
            <SelectContent>
                {groups.map(([label, values], index) => (
                    <SelectGroup
                        key={label}
                        className={[index > 0 ? 'pt-2 border-t' : '', index < groups.length - 1 ? 'pb-2' : ''].join(
                            ' '
                        )}
                    >
                        <SelectLabel>{label}</SelectLabel>
                        {values.map(value => (
                            <SelectItem key={value} value={value}>
                                {value}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                ))}
            </SelectContent>
        </Select>
    )
}
