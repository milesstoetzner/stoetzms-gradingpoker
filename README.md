# gradingpoker.stoetz.ms

- https://github.com/milesstoetzner/stoetzms-gradingpoker

## Dev 

Start the development environment and access the app at http://localhost.

```
docker compose -f docker-compose.dev.yaml up -d
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