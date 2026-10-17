FROM nginx:1.25-alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY snippets /etc/nginx/snippets
COPY 40-obscura-config.sh /docker-entrypoint.d/40-obscura-config.sh
RUN chmod +x /docker-entrypoint.d/40-obscura-config.sh \
 && rm -f /etc/nginx/conf.d/default.conf \
 && mkdir -p /var/www/certbot
EXPOSE 80 443
HEALTHCHECK --interval=15s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1/nginx-health > /dev/null || exit 1
