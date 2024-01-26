#!/bin/sh

PORT=$1

# Start the Uvicorn Server
uvicorn "app.main:app" --reload --host "0.0.0.0" --port ${PORT}
