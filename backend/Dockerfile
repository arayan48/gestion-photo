FROM node:20-alpine AS base

RUN apk add --no-cache ffmpeg python3 make g++

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
RUN npm install --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
