#!/bin/sh

PORT=$1

test -e /etc/os-release && os_release='/etc/os-release' || os_release='/usr/lib/os-release'
. "${os_release}"

REACT_APP_CONTAINER_IMAGE=${PRETTY_NAME}
export REACT_APP_CONTAINER_IMAGE

npx --yes react-inject-env set
npx --yes http-server -a 0.0.0.0 -P http://localhost:${PORT}? -p ${PORT} build
