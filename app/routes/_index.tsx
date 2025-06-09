import type {MetaFunction} from "@remix-run/node";
import {CardDemo} from "~/components/app/landing";

export const meta: MetaFunction = () => {
    return [
        {title: "planningpoker.stoetz.ms"},
        {name: "description", content: "Welcome to planningpoker.stoetz.ms!"},
    ];
};

export default function Index() {
    return (
        <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
            <div className="flex w-full max-w-sm flex-col gap-6">
                <CardDemo/>
            </div>
        </div>
    );
}