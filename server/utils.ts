import * as workaround from "@fractalsoftware/random-avatar-generator";
// @ts-ignore
const avatar = workaround.default


export function generateAvatar() {
    return avatar.getRandomAvatar(2)
}


export function haeVoid(fn: () => void): () => void {
    return async () => {
        try {
            fn()
        } catch (e) {
            console.log(e)
        }
    }
}


export function haeParameter<T>(fn: (options: T) => any): (options: T) => void {
    return async (options: T) => {
        try {
            await fn(options)
        } catch (e) {
            console.log(e)
        }
    }
}