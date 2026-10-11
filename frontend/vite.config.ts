import {vitePlugin as remix} from '@remix-run/dev'
import {defineConfig} from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

declare module '@remix-run/node' {
    interface Future {
        v3_singleFetch: true
    }
}

export default defineConfig({
    plugins: [
        remix({
            future: {
                v3_fetcherPersist: true,
                v3_relativeSplatPath: true,
                v3_throwAbortReason: true,
                v3_singleFetch: true,
                v3_lazyRouteDiscovery: true,
            },
            ssr: false,
        }),
        tsconfigPaths(),
    ],
    server: {
        allowedHosts: true,
        host: true,
        // Lets `pnpm dev` talk to a locally running backend without the nginx proxy
        proxy: {
            '/socket.io': {
                target: process.env.STOETZMS_GRADING_POKER_BACKEND ?? 'http://localhost:3000',
                ws: true,
            },
        },
    },
})
