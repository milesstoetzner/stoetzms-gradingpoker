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


## Production

Adapt the manifest and apply it.

```
kubectl apply -f kubernetes.yaml
```