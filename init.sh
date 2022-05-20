#!/bin/bash

/usr/sbin/sshd

npx --yes react-inject-env set -d /code/app/build &

uvicorn "app.main:app" --reload --host "0.0.0.0" --port 80
