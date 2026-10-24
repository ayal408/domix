# --- שלב ה-Build ---
FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
COPY package*.json ./
COPY patches ./patches
RUN npm ci
COPY . .
RUN npm run build

# --- שלב ה-Runtime ---
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]