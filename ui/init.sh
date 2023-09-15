#!/bin/sh

PORT=$1

test -e /etc/os-release && os_release='/etc/os-release' || os_release='/usr/lib/os-release'
. "${os_release}"

REACT_APP_CONTAINER_IMAGE=${PRETTY_NAME}
export REACT_APP_CONTAINER_IMAGE

printenv | grep REACT_APP_ > /tmp/react_app_

while IFS='=' read -r name value;
do
  new_name=$(echo "$name" | sed "s/REACT_APP_/VITE_/g")
  export "$new_name=$value"
done < /tmp/react_app_

printenv | grep VITE_ > /tmp/vite_

echo "window.env = {" > env.js

while IFS='=' read -r name value;
do
  echo "  \"$name\": \"$value\"," >> env.js
done < /tmp/vite_

echo "}" >> env.js

mv env.js ./dist/

npx serve -s -L -p ${PORT} dist
