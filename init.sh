#!/bin/bash
PORT=$1

# Pull Environment Variables from Parent Shell
eval $(printenv | sed -n "s/^\([^=]\+\)=\(.*\)$/export \1=\2/p" | sed 's/"/\\\"/g' | sed '/=/s//="/' | sed 's/$/"/' >> /etc/profile)

# Start the SSH Service
/usr/sbin/sshd

# Start the Uvicorn Server
uvicorn "app.main:app" --reload --host "0.0.0.0" --port ${PORT}
