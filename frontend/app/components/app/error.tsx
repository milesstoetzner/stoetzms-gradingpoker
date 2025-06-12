import React from "react";
import {AlertCircleIcon} from "lucide-react";
import {Alert, AlertTitle} from "../ui/alert";

export default function Error(props: { error?: string }) {
    return (props.error ?
            <Alert variant="destructive" className="pb-2 bg-destructive text-white">
                <AlertCircleIcon color="white" className="h-5 w-5" style={{marginTop: "-0.45rem"}}/>
                <AlertTitle className="font-normal">{props.error}</AlertTitle>
            </Alert> : <React.Fragment/>
    )
}