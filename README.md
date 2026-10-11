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

Adapt the manifest and apply it.

```
kubectl apply -f kubernetes.yaml
```