FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# Development
FROM base AS development
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

# Production build
FROM base AS builder
# --include=dev : vite est une devDependency, nécessaire au build même si
# NODE_ENV=production est injecté au build (ex. Coolify)
RUN npm install --include=dev
COPY . .
RUN npm run build

FROM nginx:1.25-alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
