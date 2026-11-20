# Smart Login Guardian — multi-stage build.
# Stage 1 compiles the Vite app; stage 2 serves the static output with nginx.
# The app is fully client-side: no backend, no environment variables, no secrets.

FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies from the lockfile first, so this layer is cached
# unless the dependency set changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
