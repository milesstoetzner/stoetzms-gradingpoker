# gradingpoker.stoetz.ms

- https://github.com/milesstoetzner/stoetzms-gradingpoker

Planning poker for grading: examiners vote on a grade in secret, reveal all votes at once and discuss the differences.

| Voting | Result | Phone |
|---|---|---|
| <img src="docs/voting.png" width="380"> | <img src="docs/result.png" width="380"> | <img src="docs/phone.png" width="150"> |


## Usage

1. **Join:** enter a room and a user name (or keep the generated ones) and join. Share the room with the share button.
2. **Vote:** pick a grade (1.0 to 5.0), a proposal verdict (Passed, Rework, Failed) or a general option (Supervisor, Withhold, Viewer). Others only see that you voted.
3. **Comment (optional):** write an anonymous comment. It is shown without your name once votes are revealed and cannot be changed while they are shown.
4. **Reveal:** anyone clicks **Show Votes**. The result shows the count, average, median, most frequent vote and the distribution, and can be downloaded as YAML. The users with the most opposite votes get a **discuss** badge.
5. **Next round:** **Hide Votes** hides them again; changing a vote does too.

Also:

- **Presentation mode** (screen icon) hides your own vote and comment field, for sharing your screen.
- **Remove User** removes someone else, **Close Room** ends the room for everyone, **Leave Room** only for you.
- If you lose the connection, your seat and vote are kept for 10 minutes and you are back in when you reconnect.
- Rooms without changes for 7 days are deleted.


## Architecture

```
browser ── WebSocket ──> Gateway ──> backend (2 replicas) ──> Redis Cluster (3 masters + 3 replicas)
        └─ static files ─────────> frontend (2 replicas)
```

- **Frontend:** a single-page app (Remix, React) served by nginx. It only talks to the backend over one WebSocket (socket.io, no long-polling), so any backend replica can serve any client without sticky sessions.
- **Backend:** stateless Node.js servers (socket.io). All state is in Redis, so any backend can serve any room.
- **Rooms:** a room is a few Redis hashes (users, votes, comments, and a version that increases with every change). Every operation is one small script that Redis runs atomically: a vote writes that user's vote and nothing else. So operations never wait for each other or conflict, and cost the same in small and large rooms.
- **Updates:** a change is published in the same step as it is written, as an event with its version, on the room's own channel (Redis sharded pub/sub). A backend subscribes to the rooms it has users in and forwards the events to them. A client gets the full state when it joins and applies events afterwards.
- **No missed updates:** a client only applies the event that is exactly one version ahead; if it sees a gap, it asks for the full state. Every 30 seconds a backend also tells its clients the current version of their room (heartbeat), which catches a missed last update. Reconnecting always loads the full state.
- **Avatars:** drawn by the client from the user name, so the same name has the same avatar everywhere and the server stores none.
- **High availability:** Kubernetes restarts and replaces backends through `/healthz` and `/readyz`; a backend that shuts down marks its users as offline, and they reconnect to another replica and take over their seat by their browser session. Redis is a Redis Cluster: rooms are spread over the masters, and when a master fails its replica takes over within seconds, during which only the rooms on that master reject changes. Redis replicates asynchronously and keeps the rooms in memory only (the volume of a node only holds its cluster membership), so a failover can lose the last writes, and losing a master together with its replica loses their rooms.
- **Scaling:** add backend replicas for more connections and Redis masters for more rooms (`backend.replicas` and `redis.replicaCount` in the chart).
- **Limits:** each connection may send 30 requests per 30 seconds; names are at most 64 and comments at most 500 characters.
- **Anonymous comments:** the author of a comment never leaves the backend. Clients get the comments only after the reveal, as texts sorted alphabetically.

## Dev 

Start the development environment and access the app at http://localhost.

```
docker compose -f docker-compose.dev.yaml up -d
```

Alternatively, run backend and frontend directly (the vite dev server proxies `/socket.io` to `http://localhost:3000`). The backend needs a Redis on `localhost:6379`.

```
docker run -d --rm --name gradingpoker-redis -p 6379:6379 redis:8.0
cd backend && pnpm dev
cd frontend && pnpm dev
```


## Tests

Backend tests need a Redis (`TEST_REDIS_HOST` and `TEST_REDIS_PORT`, by default `localhost:6379`).

```
docker run -d --rm --name gradingpoker-test-redis -p 16379:6379 redis:8.0
cd backend && TEST_REDIS_PORT=16379 pnpm test
```

Frontend unit tests:

```
cd frontend && pnpm test
```


## Release

Pull requests and merges to `main` run the checks (`.github/workflows/ci.yaml`).

Pushing a tag `v<version>` runs the checks and then publishes that version (`.github/workflows/release.yaml`):

- the images `ghcr.io/milesstoetzner/stoetzms-gradingpoker:backend-<version>` and `:frontend-<version>`,
- the Helm chart `oci://ghcr.io/milesstoetzner/charts/gradingpoker` in the same version, which uses those images by default.

```
git tag v1.0.0 && git push origin v1.0.0
```

To build and push images of the current commit from your machine instead:

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

Install or upgrade a released chart.
Settings such as the host, the Gateway to attach to, replicas and the Impressum/privacy URLs are in `chart/values.yaml`; keep your own in a values file (e.g. the git-ignored `chart/values.local.yaml`) and pass it with `-f`.
Redis runs as a Redis Cluster from the [CloudPirates Redis chart](https://github.com/CloudPirates-io/helm-charts/tree/main/charts/redis), a dependency of the chart. Do not pass `--wait` on the first install: that chart forms the cluster in a hook after the install, and the backends only become ready once the cluster exists.

```
helm upgrade --install gradingpoker oci://ghcr.io/milesstoetzner/charts/gradingpoker --version <version> --namespace gradingpoker --create-namespace
```

To install the chart from this repository instead, pass the tag of the images, e.g. the commit tag printed by `./build-and-push.sh`:

```
helm dependency build ./chart
helm upgrade --install gradingpoker ./chart --namespace gradingpoker --create-namespace --set image.tag=<tag>
```
