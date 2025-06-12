import {Button} from "../ui/button";
import Hover from "./hover";
import React from "react";
import {Info} from "lucide-react";

export default function InfoIcon(props: {message: string}) {
    return  <Hover message={props.message}>
        <Button variant="link" size="icon" className="cursor-default">
            <Info/>
        </Button>
    </Hover>
}