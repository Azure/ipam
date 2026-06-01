#!/bin/sh

PORT=$1

# Start the Uvicorn Server
exec uvicorn "app.main:app" --reload --host "0.0.0.0" --port ${PORT}
