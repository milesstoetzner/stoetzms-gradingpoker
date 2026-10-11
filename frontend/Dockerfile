FROM node:22-alpine AS build
LABEL org.opencontainers.image.source=https://github.com/milesstoetzner/stoetzms-gradingpoker
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY frontend/package.json .
COPY frontend/pnpm-lock.yaml .
RUN pnpm install
COPY frontend .
COPY spec ../spec
RUN pnpm run build

FROM nginx:alpine AS run
LABEL org.opencontainers.image.source=https://github.com/milesstoetzner/stoetzms-gradingpoker
COPY --from=build /app/build/client /usr/share/nginx/html
RUN rm /etc/nginx/conf.d/*
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/docker-entrypoint.d/40-gradingpoker-config.sh /docker-entrypoint.d/40-gradingpoker-config.sh
RUN chmod +x /docker-entrypoint.d/40-gradingpoker-config.sh
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
