import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue
} from "../ui/select";
import React from "react";


export default function Vote(props: {
    onChange: (value: string) => void
}) {

    return <Select onValueChange={props.onChange}>
        <SelectTrigger className="w-[180px]">
            <SelectValue placeholder='Still voting ...'/>
        </SelectTrigger>
        <SelectContent>
            <SelectGroup className="pb-2">
                <SelectLabel>General</SelectLabel>
                <SelectItem value="Supervisor">Supervisor</SelectItem>
                <SelectItem value="Withhold">Withhold</SelectItem>
            </SelectGroup>

            <SelectGroup className="pt-2 pb-2 border-t border-b">
                <SelectLabel>Proposal</SelectLabel>
                <SelectItem value="Passed">Passed</SelectItem>
                <SelectItem value="Rework">Rework</SelectItem>
                <SelectItem value="Failed">Failed</SelectItem>
            </SelectGroup>

            <SelectGroup className="pt-2">
                <SelectLabel>Grading</SelectLabel>
                <SelectItem value="1.0">1.0</SelectItem>
                <SelectItem value="1.3">1.3</SelectItem>
                <SelectItem value="1.7">1.7</SelectItem>
                <SelectItem value="2.0">2.0</SelectItem>
                <SelectItem value="2.3">2.3</SelectItem>
                <SelectItem value="2.7">2.7</SelectItem>
                <SelectItem value="3.0">3.0</SelectItem>
                <SelectItem value="3.3">3.3</SelectItem>
                <SelectItem value="3.7">3.7</SelectItem>
                <SelectItem value="4.0">4.0</SelectItem>
                <SelectItem value="5.0">5.0</SelectItem>
            </SelectGroup>
        </SelectContent>
    </Select>

}