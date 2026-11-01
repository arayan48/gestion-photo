# Développement uniquement (docker-compose.dev.yml). Image de production : Dockerfile à la racine.
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]
