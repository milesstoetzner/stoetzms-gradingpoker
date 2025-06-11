import React from "react";
import {AlertCircleIcon} from "lucide-react";
import {Alert, AlertTitle} from "~/components/ui/alert";

export default function Health(props: { connected: boolean }) {
    return (props.connected ? <React.Fragment/> :
            <Alert variant="destructive" className="pb-2 bg-destructive text-white">
                <AlertCircleIcon color="white" className="h-5 w-5" style={{marginTop: "-0.45rem"}}/>
                <AlertTitle className="font-normal">No connection ...</AlertTitle>
            </Alert>
    )
}