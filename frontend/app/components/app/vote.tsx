import {Button} from "../ui/button";
import React from "react";

export default function Vote(props: { vote: string }) {
    return (
        <Button variant="outline" className="w-full max-w-[200px] cursor-default hover:bg-white">
            {props.vote}
        </Button>)
}