FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY backend/package.json .
COPY backend/pnpm-lock.yaml .
RUN pnpm install
COPY backend/. .
COPY spec /
RUN pnpm run build


FROM node:22-alpine AS run
WORKDIR /app
COPY --from=build /app/build/ .
EXPOSE 80
CMD ["node", "index.js"]
