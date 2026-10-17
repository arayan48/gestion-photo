FROM node:20-alpine AS base
WORKDIR /app

# Dépendances de production. Outils de compilation présents seulement dans cette
# étape (repli si argon2 / sharp n'ont pas de binaire précompilé pour l'architecture)
FROM base AS deps
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Development
FROM base AS development
RUN apk add --no-cache python3 make g++ ffmpeg postgresql-client rclone tar
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production
FROM base AS production
# ffmpeg (vidéos), pg_dump + rclone + tar (sauvegardes), su-exec (abandon des droits root)
RUN apk add --no-cache ffmpeg postgresql-client rclone tar su-exec
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN chmod +x docker-entrypoint.sh && mkdir -p /app/storage /app/data && chown node:node /app/storage /app/data
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${APP_PORT:-3000}/api/health" > /dev/null || exit 1
ENTRYPOINT ["/app/docker-entrypoint.sh"]
# node directement (pas npm) : reçoit SIGTERM et s'arrête proprement à chaque redéploiement
CMD ["node", "src/index.js"]
