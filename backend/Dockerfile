FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY backend/package.json .
COPY backend/pnpm-lock.yaml .
RUN pnpm install
COPY backend .
COPY spec ../spec
RUN pnpm run build
EXPOSE 3000
CMD ["node", "build/index.js"]
