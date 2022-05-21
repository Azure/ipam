#!/bin/sh

echo "window.env = {" >> /app/build/env.js
echo \"REACT_APP_CLIENT_ID\": \"$CLIENT_ID\", >> /app/build.env.js
echo \"REACT_APP_TENANT_ID\": \"$TENANT_ID\" >> /app/build.env.js
echo "}" >> /app/build/env.js

nginx -g daemon off;
