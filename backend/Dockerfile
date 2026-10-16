FROM node:20-alpine AS base

# postgresql-client (pg_dump) et rclone sont nécessaires aux sauvegardes
RUN apk add --no-cache ffmpeg python3 make g++ postgresql-client rclone tar

WORKDIR /app

COPY package*.json ./

# Development
FROM base AS development
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production
FROM base AS production
RUN npm install --omit=dev
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
