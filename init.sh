#!/bin/bash
PORT=$1

if [ "${WEBSITE_RUN_FROM_PACKAGE:-}" = "1" ]; then
  # ZIP mounts read-only with no venv, so point Python at the bundled packages
  APP_ROOT="$(cd "$(dirname "$0")" && pwd)"
  export PYTHONPATH="${PYTHONPATH:+$PYTHONPATH:}$APP_ROOT/packages"
fi

# Pull Environment Variables from Parent Shell
eval $(printenv | sed -n "s/^\([^=]\+\)=\(.*\)$/export \1=\2/p" | sed 's/"/\\\"/g' | sed '/=/s//="/' | sed 's/$/"/' >> /etc/profile)

# Start the SSH Service
/usr/sbin/sshd

# Start the Uvicorn Server
exec python -m uvicorn "app.main:app" --host "0.0.0.0" --port ${PORT}
