# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build
ARG EXTRA_CA_SHA256=none
WORKDIR /app
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
COPY package*.json ./
COPY patches ./patches
RUN --mount=type=secret,id=extra_ca,required=false \
    test -n "$EXTRA_CA_SHA256" && if [ -s /run/secrets/extra_ca ]; then \
      ! grep -q 'PRIVATE KEY' /run/secrets/extra_ca \
      && grep -q 'BEGIN CERTIFICATE' /run/secrets/extra_ca \
      && NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca npm ci; \
    else npm ci; fi
COPY . .
RUN npm run build

# The browser uses Windows/browser trust; no local CA is copied into the public web assets.
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
