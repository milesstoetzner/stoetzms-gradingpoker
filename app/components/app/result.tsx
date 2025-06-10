import {CardContent, CardHeader, CardTitle} from "~/components/ui/card";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "~/components/ui/table";
import React from "react";
import {User} from "~/components/app/room";
import average from 'average'
import median from 'median'

type Distribution = {
    vote: string
    absolute: number
}

export function ResultContent(props: {
    users: User[]
}) {

    const strings = props.users.filter(it => it.vote).map(it => String(it.vote))
    const numbers = props.users.map(it => Number(it.vote)).filter(it => !Number.isNaN(it))

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
                        <TableHead>Statistic</TableHead>
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
                            {average(numbers).toFixed(2)}
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
                            {distribution[0].vote}
                        </TableCell>
                    </TableRow>

                    <TableRow className="h-[57px]">
                        <TableCell>
                            Distribution
                        </TableCell>
                        <TableCell>
                            <table>
                                <tbody>
                                {distribution.map(dist => (
                                    <tr key={dist.vote}>
                                        <td className="w-[100px]">{dist.vote == 'undefined' ? 'Still voting ...' : dist.vote}</td>
                                        <td className="w-[50px]">{dist.absolute}</td>
                                        <td>{(dist.absolute / strings.length * 100).toFixed(0)}&#37;</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </CardContent>
    </React.Fragment>)
}