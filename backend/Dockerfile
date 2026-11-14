FROM node:22-alpine
LABEL org.opencontainers.image.source=https://github.com/milesstoetzner/stoetzms-gradingpoker
# pnpm in the version pinned by packageManager in package.json
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app
COPY backend/package.json .
COPY backend/pnpm-lock.yaml .
RUN pnpm install --frozen-lockfile
COPY backend .
COPY spec ../spec
RUN pnpm run build
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "build/index.js"]
