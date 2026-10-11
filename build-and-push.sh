#!/usr/bin/env bash
set -e

REPO=ghcr.io/milesstoetzner/stoetzms-gradingpoker
TAG=$(git rev-parse --short HEAD)

BACKEND_IMAGE=$REPO:backend-$TAG
FRONTEND_IMAGE=$REPO:frontend-$TAG

docker build -t $BACKEND_IMAGE -f ./backend/Dockerfile .
docker push $BACKEND_IMAGE

docker build -t $FRONTEND_IMAGE -f ./frontend/Dockerfile .
docker push $FRONTEND_IMAGE

echo
echo
echo "Built and pushed images:"
echo $BACKEND_IMAGE
echo $FRONTEND_IMAGE
echo
echo "Commit tag:"
echo $TAG
