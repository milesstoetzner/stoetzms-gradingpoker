# gradingpoker.stoetz.ms

- https://github.com/milesstoetzner/stoetzms-gradingpoker

## Dev 

Start the development environment and access the app at http://localhost.

```
docker compose -f docker-compose.dev.yaml up -d
```

Alternatively, run backend and frontend directly (the vite dev server proxies `/socket.io` to `http://localhost:3000`).

```
cd backend && pnpm dev
cd frontend && pnpm dev
```


## Tests

Backend integration tests run against the in-memory persistency and, if `TEST_REDIS_PORT` is set, also against Redis.

```
docker run -d --rm --name gradingpoker-test-redis -p 16379:6379 redis:8.0
cd backend && TEST_REDIS_PORT=16379 pnpm test
```

Frontend unit tests:

```
cd frontend && pnpm test
```


## Release

Build the release image.

```
./build-and-push.sh
```


## Configuration

The frontend image reads the following environment variables at container startup.
A link is only shown if its variable is set.

| Variable                               | Description                                      |
|----------------------------------------|--------------------------------------------------|
| `STOETZMS_GRADING_POKER_IMPRESSUM_URL` | URL of the Impressum linked below the join card  |
| `STOETZMS_GRADING_POKER_PRIVACY_URL`   | URL of the privacy policy linked next to it      |


## Production

Install or upgrade the Helm chart with the commit tag printed by `./build-and-push.sh`.
Settings such as the host, the Gateway to attach to, replicas and the Impressum/privacy URLs are in `chart/values.yaml`.
Redis runs with Redis Sentinel from the [CloudPirates Redis chart](https://github.com/CloudPirates-io/helm-charts/tree/main/charts/redis), a dependency of the chart.

```
helm dependency build ./chart
helm upgrade --install gradingpoker ./chart --namespace gradingpoker --create-namespace --set image.tag=<tag>
```