# --- שלב 1: בניית ה-React ---
FROM node:20-alpine AS client-build
WORKDIR /app
COPY domix-client/package*.json ./
RUN npm install
COPY domix-client/ ./
RUN npm run build

# --- שלב 2: שרת Nginx סופי ---
FROM nginx:alpine
COPY --from=client-build /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]