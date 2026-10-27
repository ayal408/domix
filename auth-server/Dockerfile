# syntax=docker/dockerfile:1.7
FROM node:22-alpine
ARG EXTRA_CA_SHA256=none
WORKDIR /app
COPY package*.json ./
# Optional, explicit CA trust for npm. TLS verification stays enabled.
RUN --mount=type=secret,id=extra_ca,required=false \
    test -n "$EXTRA_CA_SHA256" && if [ -s /run/secrets/extra_ca ]; then \
      ! grep -q 'PRIVATE KEY' /run/secrets/extra_ca \
      && grep -q 'BEGIN CERTIFICATE' /run/secrets/extra_ca \
      && NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca npm ci --omit=dev --no-audit --no-fund; \
    else npm ci --omit=dev --no-audit --no-fund; fi
# Google token verification runs in Node, which needs its own extra trust at process start.
RUN --mount=type=secret,id=extra_ca,required=false \
    test -n "$EXTRA_CA_SHA256" && if [ -s /run/secrets/extra_ca ]; then \
      ! grep -q 'PRIVATE KEY' /run/secrets/extra_ca \
      && grep -q 'BEGIN CERTIFICATE' /run/secrets/extra_ca \
      && mkdir -p /usr/local/share/domix \
      && cp /run/secrets/extra_ca /usr/local/share/domix/extra-ca.pem; fi
COPY . .
COPY docker-entrypoint.sh /usr/local/bin/domix-auth-entrypoint
EXPOSE 5000
ENTRYPOINT ["sh", "/usr/local/bin/domix-auth-entrypoint"]
CMD ["node", "app.js"]
