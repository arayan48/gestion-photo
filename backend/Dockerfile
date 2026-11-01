# Développement uniquement (docker-compose.dev.yml). Image de production : Dockerfile à la racine.
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++ ffmpeg postgresql-client rclone tar
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
