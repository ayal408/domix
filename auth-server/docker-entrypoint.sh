#!/bin/sh
set -eu
if [ -n "${NODE_EXTRA_CA_CERTS:-}" ]; then
  if [ ! -s "$NODE_EXTRA_CA_CERTS" ]; then
    echo 'NODE_EXTRA_CA_CERTS must point to a readable, non-empty CA bundle.' >&2
    exit 1
  fi
elif [ -s /usr/local/share/domix/extra-ca.pem ]; then
  export NODE_EXTRA_CA_CERTS=/usr/local/share/domix/extra-ca.pem
fi
exec "$@"
