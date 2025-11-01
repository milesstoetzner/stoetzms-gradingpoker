#!/usr/bin/env bash
set -e

REPO=ghcr.io/milesstoetzner/stoetzms-gradingpoker
TAG=$(git rev-parse --short HEAD)

docker build -t $REPO:backend-$TAG -f ./backend/Dockerfile .
docker push $REPO:backend-$TAG

docker build -t $REPO:frontend-$TAG -f ./frontend/Dockerfile .
docker push $REPO:frontend-$TAG
