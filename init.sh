#!/bin/bash
PORT=$1

if [ $WEBSITE_RUN_FROM_PACKAGE = "1" ]; then
  export PATH=$PATH:$APP_PATH/packages
  export PYTHONPATH=$PYTHONPATH:$APP_PATH/packages
fi

# Pull Environment Variables from Parent Shell
eval $(printenv | sed -n "s/^\([^=]\+\)=\(.*\)$/export \1=\2/p" | sed 's/"/\\\"/g' | sed '/=/s//="/' | sed 's/$/"/' >> /etc/profile)

# Start the SSH Service
/usr/sbin/sshd

# Start the Uvicorn Server
python -m uvicorn "app.main:app" --reload --host "0.0.0.0" --port ${PORT}
