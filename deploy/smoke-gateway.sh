#!/usr/bin/env bash
# CI only: call a gateway connected to an empty disposable database.
set -Eeuo pipefail
base="${1:-http://127.0.0.1:8080}"
for attempt in $(seq 1 90); do
  if curl -fsS "$base/api/health/db-query" >/dev/null && curl -fsS "$base/api/auth/healthz" >/dev/null; then break; fi
  sleep 2
done
curl -fsS "$base/api/health/db-query" >/dev/null
curl -fsS "$base/api/auth/healthz" | python3 -c 'import json,sys; assert json.load(sys.stdin)["status"] == "ok"'
curl -fsS "$base/exchange" | python3 -c 'import sys; assert "<html" in sys.stdin.read()'
code=$(curl -s -o /dev/null -w '%{http_code}' "$base/api/User/by-email/test@example.com")
test "$code" = 404
curl -fsS "$base/api/auth/register" -H 'Content-Type: application/json' \
  --data '{"userName":"deploysmoke","email":"smoke@example.com","password":"Test-Only-Password123"}' \
  | python3 -c 'import json,sys; assert json.load(sys.stdin).get("accessToken")'
echo 'Gateway, API, auth, SPA routes and internal-route protection passed.'
