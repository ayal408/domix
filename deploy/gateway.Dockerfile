# One of the two free Northflank Sandbox services: SPA + nginx + auth.
FROM node:22-alpine AS client
WORKDIR /src
COPY domix-client/package*.json ./
COPY domix-client/patches ./patches
RUN npm ci
COPY domix-client/ ./
ARG VITE_GOOGLE_CLIENT_ID=
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

FROM node:22-alpine AS auth
WORKDIR /app/auth
COPY auth-server/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY auth-server/ ./

FROM node:22-alpine
RUN apk add --no-cache nginx bash gettext tini
WORKDIR /app/auth
COPY --from=auth /app/auth/ ./
COPY --from=client /src/dist /usr/share/nginx/html
COPY domix-client/nginx.conf /app/gateway.template.conf
COPY deploy/start-gateway.sh /app/start-gateway.sh
RUN chmod +x /app/start-gateway.sh && mkdir -p /run/nginx
ENV NODE_ENV=production COOKIE_SAME_SITE=strict PORT=8080
EXPOSE 8080
ENTRYPOINT ["/sbin/tini", "--", "/app/start-gateway.sh"]
