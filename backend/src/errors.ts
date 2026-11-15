export class TooManyRequests extends Error {
    constructor() {
        super('Too many requests ...')
    }
}
