import {CardContent, CardHeader, CardTitle} from '../ui/card'
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '../ui/table'
import React from 'react'
import {User, Votes} from '../../../../spec/types'
import {Button} from '../ui/button'
import InfoIcon from './info'
import Vote from './vote'
import Hover from './hover'
import {MonitorDown} from 'lucide-react'
import {Discussion} from '../../lib/discussion'
import * as yaml from 'js-yaml'
import {download} from '../../lib/download'
import {summarize} from '../../lib/statistics'

export function ResultContent(props: {
    votes: Votes
    users: User[]
    room: string
    discussion?: Discussion
    comments: string[]
}) {
    const statistics = summarize(props.votes)

    function onDownload() {
        const date = new Date().toISOString()
        const data = {
            room: props.room,
            date,
            users: props.users.map(user => user.name),
            votes: props.votes,
            ...statistics,
            discussion: props.discussion,
            comments: props.comments,
        }

        download(`gradingpoker.${date}.yaml`, 'data:text/yaml;charset=utf-8,', yaml.dump(data, {noRefs: true}))
    }

    return (
        <React.Fragment>
            <CardHeader
                className="flex flex-row justify-between items-center px-4 sm:px-6"
                style={{marginTop: '-12px', marginBottom: '-10px'}}
            >
                <CardTitle>Result</CardTitle>

                <span className="flex items-center gap-2 ml-auto">
                    <Hover message="Download Result">
                        <Button variant="outline" className="size-8" onClick={onDownload}>
                            <MonitorDown />
                        </Button>
                    </Hover>
                </span>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[40%] sm:w-[200px]">Metric</TableHead>
                            <TableHead>Value</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow className="h-[57px]">
                            <TableCell className="flex items-center">
                                Votes
                                <InfoIcon message="Total numbers of votes" />
                            </TableCell>
                            <TableCell>{statistics.strings.length}</TableCell>
                        </TableRow>

                        <TableRow className="h-[57px]">
                            <TableCell className="flex items-center">
                                Average
                                <InfoIcon message="The mathematical average of numeric votes" />
                            </TableCell>
                            <TableCell>{statistics.average}</TableCell>
                        </TableRow>

                        <TableRow className="h-[57px]">
                            <TableCell className="flex items-center">
                                Median
                                <InfoIcon message="The mathematical median of numeric votes" />
                            </TableCell>
                            <TableCell>{statistics.median}</TableCell>
                        </TableRow>

                        <TableRow className="h-[57px]">
                            <TableCell className="flex items-center">
                                Most
                                <InfoIcon message="The value with the highest absolute votes" />
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-wrap items-center gap-2">
                                    {statistics.most.map(share => (
                                        <Vote vote={share.vote} key={share.vote} />
                                    ))}
                                </div>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>

                <div className="pt-12" />

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[40%] sm:w-[200px]">Vote</TableHead>
                            <TableHead className="sm:w-[200px]">
                                <div className="flex items-center">
                                    Absolute
                                    <InfoIcon message="The absolute number of votes" />
                                </div>
                            </TableHead>
                            <TableHead>
                                <div className="flex items-center">
                                    Relative
                                    <InfoIcon message="The absolute number of votes relative to all votes" />
                                </div>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {statistics.distribution.map(share => (
                            <TableRow key={share.vote} className="h-[57px]">
                                <TableCell>
                                    <Vote vote={share.vote} />
                                </TableCell>
                                <TableCell>{share.absolute}</TableCell>
                                <TableCell>{share.relative}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                {props.comments.length > 0 && (
                    <div className="pt-12">
                        <h3 className="pb-4 text-sm font-medium text-muted-foreground">
                            Anonymous Comments ({props.comments.length})
                        </h3>
                        <ul className="grid gap-2">
                            {props.comments.map((comment, index) => (
                                <li
                                    key={index}
                                    className="whitespace-pre-wrap break-words rounded-md border bg-background px-3 py-2 text-sm animate-in fade-in"
                                >
                                    {comment}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </CardContent>
        </React.Fragment>
    )
}
