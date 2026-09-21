#!/bin/sh

PORT=$1

# Start the Uvicorn Server
exec uvicorn "app.main:app" --host "0.0.0.0" --port ${PORT}
