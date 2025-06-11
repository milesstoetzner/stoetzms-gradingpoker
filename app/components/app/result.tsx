import {CardContent, CardHeader, CardTitle} from "~/components/ui/card";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "~/components/ui/table";
import React from "react";
import average from 'average'
import median from 'median'
import {Votes} from "~/socket/types";

type Distribution = {
    vote: string
    absolute: number
}

export function ResultContent(props: {
    votes: Votes
}) {

    const values = Object.values(props.votes)
    const strings = values.filter(it => it !== null && it !== undefined && it !== '').map(it => String(it))
    const numbers= strings.map(it => Number(it)).filter(it => !Number.isNaN(it))

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
                        <TableHead className="w-[100px]">Metric</TableHead>
                        <TableHead>Value</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow className="h-[57px]">
                        <TableCell>
                            Votes
                        </TableCell>
                        <TableCell>
                            {strings.length}
                        </TableCell>
                    </TableRow>


                    <TableRow className="h-[57px]">
                        <TableCell>
                            Average
                        </TableCell>
                        <TableCell>
                            {numbers.length === 0 ? Number.NaN : average(numbers).toFixed(2)}
                        </TableCell>
                    </TableRow>


                    <TableRow className="h-[57px]">
                        <TableCell>
                            Median
                        </TableCell>
                        <TableCell>
                            {median(numbers).toFixed(2)}
                        </TableCell>
                    </TableRow>


                    <TableRow className="h-[57px]">
                        <TableCell>
                            Most
                        </TableCell>
                        <TableCell>
                            {distribution.filter(it => it.absolute === distribution[0].absolute).map(it => it.vote).join(', ')}
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>

            <div className="pt-12"/>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Vote</TableHead>
                        <TableHead>Absolute</TableHead>
                        <TableHead>Relative</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>

                    {distribution.map(dist => (

                        <TableRow key={dist.vote} className="h-[57px]">
                            <TableCell>
                                {dist.vote == 'undefined' ? 'Still voting ...' : dist.vote}
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