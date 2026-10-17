FROM certbot/certbot:v2.11.0
COPY certbot-loop.sh /usr/local/bin/certbot-loop.sh
RUN chmod +x /usr/local/bin/certbot-loop.sh && mkdir -p /var/www/certbot
ENTRYPOINT ["/usr/local/bin/certbot-loop.sh"]
