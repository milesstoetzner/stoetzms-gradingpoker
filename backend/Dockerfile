FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json .
COPY pnpm-lock.yaml .
RUN pnpm install
COPY . .
RUN pnpm run build


FROM node:22-alpine AS run
WORKDIR /app
COPY --from=build /app/build/ .
EXPOSE 80
CMD ["node", "index.js"]
