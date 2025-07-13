import {CardContent, CardHeader, CardTitle} from '../ui/card'
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '../ui/table'
import React from 'react'
// @ts-ignore
import getAverage from 'average'
// @ts-ignore
import getMedian from 'median'
import {User, Votes} from '../../../../spec/types'
import {Button} from '../ui/button'
import InfoIcon from './info'
import Vote from './vote'
import Hover from "./hover";
import {MonitorDown} from "lucide-react";
import * as yaml from 'js-yaml'

type Distribution = {
    vote: string
    absolute: number
    relative: string
}


export function download(name: string, type: string, data: string) {
    const element = document.createElement('a')
    element.setAttribute('href', type + encodeURIComponent(data))
    element.setAttribute('download', name)
    element.style.display = 'none'
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
}

export function ResultContent(props: { votes: Votes, users: User[], room: string }) {
    const values = Object.values(props.votes)
    const strings = values.filter(it => it !== null && it !== undefined && it !== '').map(it => String(it))
    const numbers = strings.map(it => Number(it)).filter(it => !Number.isNaN(it))

    let distribution: Distribution[] = []
    strings.forEach(vote => {
        const found = distribution.find(it => it.vote === vote)
        if (found) {
            found.absolute++
            found.relative = ((found.absolute / strings.length) * 100).toFixed(0) + "%"
        } else {
            distribution.push({
                vote,
                absolute: 1,
                relative: ((1 / strings.length) * 100).toFixed(0) + "%"
            })
        }

    })
    distribution = distribution.sort((a, b) => b.absolute - a.absolute)

    const average = numbers.length === 0 ? '(no numeric votes)' : getAverage(numbers).toFixed(2)
    const median = numbers.length === 0 ? '(no numeric votes)' : getMedian(numbers).toFixed(2)
    const most = distribution.filter(it => it.absolute === distribution[0].absolute)

    function onDownload() {
        const date = new Date().toISOString()
        const data = {
            room: props.room,
            date,
            users: props.users.map(it => it.name),
            votes: props.votes,
            values,
            strings,
            numbers,
            distribution,
            average,
            median,
            most
        }

        download(`gradingpoker.${date}.yaml`, 'data:text/yaml;charset=utf-8,', yaml.dump(data, {noRefs: true}))
    }

    return (
        <React.Fragment>
            <CardHeader
                className="flex flex-row justify-between items-center"
                style={{marginTop: '-12px', marginBottom: '-10px'}}
            >
                <CardTitle>Result</CardTitle>

                <span className="flex items-center gap-2 ml-auto">
                                <Hover message="Download Result">
                                <Button variant="outline" className="size-8" onClick={onDownload}>
                                    <MonitorDown size="icon"/>
                                </Button>
                                </Hover>
                            </span>

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
                                <InfoIcon message="Total numbers of votes"/>
                            </TableCell>
                            <TableCell>{strings.length}</TableCell>
                        </TableRow>

                        <TableRow className="h-[57px]">
                            <TableCell className="flex items-center">
                                Average
                                <InfoIcon message="The mathematical average of numeric votes"/>
                            </TableCell>
                            <TableCell>{average}</TableCell>
                        </TableRow>

                        <TableRow className="h-[57px]">
                            <TableCell className="flex items-center">
                                Median
                                <InfoIcon message="The mathematical median of numeric votes"/>
                            </TableCell>
                            <TableCell>{median}</TableCell>
                        </TableRow>

                        <TableRow className="h-[57px]">
                            <TableCell className="flex items-center">
                                Most
                                <InfoIcon message="The value with the highest absolute votes"/>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    {most.map(it => (
                                        <Vote vote={it.vote} key={it.vote}/>
                                    ))}
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
                                <TableCell>{dist.absolute}</TableCell>
                                <TableCell>{dist.relative}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </React.Fragment>
    )
}
