import * as workaround from "@fractalsoftware/random-avatar-generator";
// @ts-ignore
const avatar = workaround.default


export function generateAvatar() {
    return avatar.getRandomAvatar(2)
}