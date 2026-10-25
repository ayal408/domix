#!/usr/bin/env bash
set -Eeuo pipefail
: "${DATA_SERVICE_URL:?Set the API internal HTTP URL}"
: "${JWT_SECRET:?Set a shared random secret}"
: "${INTERNAL_SERVICE_KEY:?Set a shared internal key}"
# Never interpolate arbitrary text into nginx configuration.
if [[ ! "$DATA_SERVICE_URL" =~ ^http://[a-zA-Z0-9.-]+:[0-9]+$ ]]; then
  echo 'DATA_SERVICE_URL must be an internal http://hostname:port URL' >&2
  exit 1
fi
if [[ ! "${PORT:-8080}" =~ ^[0-9]+$ ]]; then exit 1; fi
export DOMIX_UPSTREAM="${DATA_SERVICE_URL#http://}"
sed -e "s/listen 80;/listen ${PORT:-8080};/" \
    -e 's/auth-server:5000/127.0.0.1:5000/g' \
    -e 's/domix-server:8080/${DOMIX_UPSTREAM}/g' \
    /app/gateway.template.conf | envsubst '${DOMIX_UPSTREAM}' > /etc/nginx/http.d/default.conf
nginx -t
# Auth is reachable through nginx only; the single public port belongs to nginx.
PORT=5000 node app.js &
auth_pid=$!
nginx -g 'daemon off;' &
nginx_pid=$!
cleanup() { kill -TERM "$auth_pid" "$nginx_pid" 2>/dev/null || true; wait "$auth_pid" "$nginx_pid" 2>/dev/null || true; }
trap cleanup EXIT
trap 'exit 0' TERM INT
# If either process dies, terminate the other and let the platform restart the service.
set +e
wait -n "$auth_pid" "$nginx_pid"
exit 1
