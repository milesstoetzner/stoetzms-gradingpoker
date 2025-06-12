import {CardContent, CardHeader, CardTitle} from "../ui/card";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "../ui/table";
import React from "react";
// @ts-ignore
import average from 'average'
// @ts-ignore
import median from 'median'
import {Votes} from "../../../../spec/types";
import {Button} from "../ui/button";
import InfoIcon from "./info";
import Vote from "./vote";

type Distribution = {
    vote: string
    absolute: number
}

export function ResultContent(props: {
    votes: Votes
}) {

    const values = Object.values(props.votes)
    const strings = values.filter(it => it !== null && it !== undefined && it !== '').map(it => String(it))
    const numbers = strings.map(it => Number(it)).filter(it => !Number.isNaN(it))

    let distribution: Distribution[] = []
    strings.forEach(vote => {
        const found = distribution.find(it => it.vote === vote)
        if (found) return found.absolute++
        distribution.push({
            vote,
            absolute: 1,
        })
    })
    distribution = distribution.sort((a, b) => b.absolute - a.absolute)

    return (<React.Fragment>
        <CardHeader>
            <CardTitle>Result</CardTitle>
        </CardHeader>

        <CardContent>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[200px]">Metric</TableHead>
                        <TableHead>Value</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow className="h-[57px]">
                        <TableCell className="flex items-center">
                            Votes

                            <InfoIcon message="Total votes"/>
                        </TableCell>
                        <TableCell>
                            {strings.length}
                        </TableCell>
                    </TableRow>


                    <TableRow className="h-[57px]">
                        <TableCell className="flex items-center">
                            Average

                            <InfoIcon message="The mathematical average of numeric votes"/>
                        </TableCell>
                        <TableCell>
                            {numbers.length === 0 ? Number.NaN : average(numbers).toFixed(2)}
                        </TableCell>
                    </TableRow>


                    <TableRow className="h-[57px]">
                        <TableCell className="flex items-center">
                            Median

                            <InfoIcon message="The mathematical median of numeric votes"/>
                        </TableCell>
                        <TableCell>
                            {median(numbers).toFixed(2)}
                        </TableCell>
                    </TableRow>


                    <TableRow className="h-[57px]">
                        <TableCell className="flex items-center">
                            Most

                            <InfoIcon message="The value with the highest absolute votes"/>
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center gap-2">
                                {distribution.filter(it => it.absolute === distribution[0].absolute).map(it =>
                                    <Vote vote={it.vote} key={it.vote}/>)}
                            </div>

                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>

            <div className="pt-12"/>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[200px]">Vote</TableHead>
                        <TableHead className="w-[200px]">
                            <div className="flex items-center">
                                Absolute
                                <InfoIcon message="The absolute number of votes"/>
                            </div>
                        </TableHead>
                        <TableHead>
                            <div className="flex items-center">
                                Relative
                                <InfoIcon message="The absolute number of votes relative to all votes"/>
                            </div>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>

                    {distribution.map(dist => (

                        <TableRow key={dist.vote} className="h-[57px]">
                            <TableCell>
                                <Vote vote={dist.vote}/>
                            </TableCell>
                            <TableCell>
                                {dist.absolute}
                            </TableCell>
                            <TableCell>
                                {(dist.absolute / strings.length * 100).toFixed(0)}&#37;
                            </TableCell>
                        </TableRow>
                    ))}


                </TableBody>
            </Table>


        </CardContent>
    </React.Fragment>)
}