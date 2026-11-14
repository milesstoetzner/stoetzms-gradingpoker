FROM node:22-alpine AS build
LABEL org.opencontainers.image.source=https://github.com/milesstoetzner/stoetzms-gradingpoker
# pnpm in the version pinned by packageManager in package.json
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app
COPY frontend/package.json .
COPY frontend/pnpm-lock.yaml .
RUN pnpm install --frozen-lockfile
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
