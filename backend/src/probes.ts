import {createServer} from 'node:http'

/**
 * HTTP server with the probes for Kubernetes. socket.io attaches to it and handles its own path before these.
 *
 * - /healthz: the process is alive.
 * - /readyz: the server can serve clients (see isReady).
 */
export function createProbeServer(isReady: () => Promise<boolean>) {
    return createServer(async (request, response) => {
        try {
            if (request.url === '/healthz') return response.writeHead(200).end('ok')
            if (request.url === '/readyz') {
                const ready = await isReady()
                return response.writeHead(ready ? 200 : 503).end(ready ? 'ok' : 'not ready')
            }
            response.writeHead(404).end()
        } catch (e) {
            console.log(e)
            response.writeHead(500).end()
        }
    })
}
