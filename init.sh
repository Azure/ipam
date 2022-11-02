#!/bin/bash

export REACT_APP_CLIENT_ID=$CLIENT_ID
export REACT_APP_TENANT_ID=$TENANT_ID

eval $(printenv | sed -n "s/^\([^=]\+\)=\(.*\)$/export \1=\2/p" | sed 's/"/\\\"/g' | sed '/=/s//="/' | sed 's/$/"/' >> /etc/profile)

/usr/sbin/sshd

npx --yes react-inject-env set -d /code/app/build &

uvicorn "app.main:app" --reload --host "0.0.0.0" --port 80

