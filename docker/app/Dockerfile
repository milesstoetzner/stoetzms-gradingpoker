FROM node:22-bookworm AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json .
COPY pnpm-lock.yaml .
RUN pnpm install
COPY . .
RUN pnpm run build

FROM nginx:alpine as run
COPY --from=build /app/build/client /usr/share/nginx/html
RUN rm /etc/nginx/conf.d/*
COPY docker/app/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]