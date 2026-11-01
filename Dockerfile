# Obscura — image unique : API Fastify + interface React (servie par Fastify)
#   docker build -t obscura .

# Interface : build Vite, puis fichiers précompressés (servis tels quels, sans calcul à chaque requête)
FROM node:20-alpine AS frontend
WORKDIR /app
RUN apk add --no-cache brotli
COPY frontend/package*.json ./
# --include=dev : vite est une devDependency, nécessaire au build même si NODE_ENV=production
RUN npm install --include=dev
COPY frontend/ ./
RUN npm run build \
 && find dist -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.svg' -o -name '*.json' \) \
      -exec gzip -9 -k {} \; -exec brotli -q 11 -k {} \;

# Dépendances de production. Outils de compilation présents seulement dans cette
# étape (repli si argon2 / sharp n'ont pas de binaire précompilé pour l'architecture)
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY backend/package*.json ./
RUN npm install --omit=dev && npm cache clean --force

FROM node:20-alpine
WORKDIR /app
# ffmpeg (vidéos), pg_dump + rclone + tar (sauvegardes), su-exec (abandon des droits root)
RUN apk add --no-cache ffmpeg postgresql-client rclone tar su-exec
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY backend/ ./
COPY --from=frontend /app/dist ./public
RUN chmod +x docker-entrypoint.sh && mkdir -p /app/storage /app/data && chown node:node /app/storage /app/data
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${APP_PORT:-3000}/api/health" > /dev/null || exit 1
ENTRYPOINT ["/app/docker-entrypoint.sh"]
# node directement (pas npm) : reçoit SIGTERM et s'arrête proprement à chaque redéploiement
CMD ["node", "src/index.js"]
