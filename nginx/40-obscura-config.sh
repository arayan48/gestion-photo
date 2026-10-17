#!/bin/sh
# Génère la configuration nginx d'Obscura au démarrage du conteneur.
#
#   TRUSTED_PROXIES  proxys dont on accepte X-Forwarded-For (CIDR séparés par des espaces).
#                    Défaut : réseaux privés = proxy placé devant nginx sur le réseau Docker
#                    (Coolify/Traefik, Caddy…). « none » pour désactiver.
#   DOMAIN           domaine public. Si un certificat Let's Encrypt existe pour lui
#                    (service certbot), nginx sert HTTPS et redirige HTTP → HTTPS.
#                    Vide : HTTP seul (TLS géré par un proxy en amont).
set -eu

CONF_DIR=/etc/nginx/conf.d
TRUSTED_PROXIES="${TRUSTED_PROXIES:-10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 fc00::/7}"
DOMAIN="${DOMAIN:-}"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"

# IPv6 seulement si le conteneur l'a (sinon nginx refuse de démarrer)
if [ -s /proc/net/if_inet6 ]; then IPV6=""; else IPV6="# "; fi

rm -f "$CONF_DIR/default.conf"

# ── Vraie IP client ──────────────────────────────────────────────────────────
# Sans ça, derrière un proxy, toutes les requêtes semblent venir de lui : un ban
# bloque tout le monde, et la liste blanche IP est contournée (IP privée).
{
  echo "# Généré par 40-obscura-config.sh — ne pas modifier"
  if [ "$TRUSTED_PROXIES" != "none" ]; then
    for cidr in $TRUSTED_PROXIES; do
      echo "set_real_ip_from $cidr;"
    done
    echo "real_ip_header X-Forwarded-For;"
    echo "real_ip_recursive on;"
  fi
} > "$CONF_DIR/realip.conf"

# ── Serveur(s) ───────────────────────────────────────────────────────────────
write_server_conf() {
  if [ -n "$DOMAIN" ] && [ -s "$CERT_DIR/fullchain.pem" ] && [ -s "$CERT_DIR/privkey.pem" ]; then
    cat > "$CONF_DIR/obscura.conf" <<CONF
# Généré par 40-obscura-config.sh — mode HTTPS ($DOMAIN)
server {
    listen 80;
    ${IPV6}listen [::]:80;
    server_name _;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Healthcheck Docker (indépendant du backend et de la redirection HTTPS)
    location = /nginx-health {
        access_log off;
        return 200 "ok";
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    ${IPV6}listen [::]:443 ssl;
    http2 on;
    server_name _;

    ssl_certificate     $CERT_DIR/fullchain.pem;
    ssl_certificate_key $CERT_DIR/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    add_header Strict-Transport-Security "max-age=31536000" always;
    include /etc/nginx/snippets/obscura-locations.conf;
}
CONF
    echo "obscura: HTTPS activé pour $DOMAIN"
  else
    cat > "$CONF_DIR/obscura.conf" <<CONF
# Généré par 40-obscura-config.sh — mode HTTP
server {
    listen 80;
    ${IPV6}listen [::]:80;
    server_name _;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Healthcheck Docker (indépendant du backend et de la redirection HTTPS)
    location = /nginx-health {
        access_log off;
        return 200 "ok";
    }

    include /etc/nginx/snippets/obscura-locations.conf;
}
CONF
    if [ -n "$DOMAIN" ]; then
      echo "obscura: pas encore de certificat pour $DOMAIN — HTTP seul en attendant certbot"
    else
      echo "obscura: HTTP seul (DOMAIN non défini : TLS géré en amont)"
    fi
  fi
}

write_server_conf

# ── Certificat obtenu ou renouvelé → recharger nginx ─────────────────────────
if [ -n "$DOMAIN" ]; then
  (
    cert_state() { stat -L -c %Y "$CERT_DIR/fullchain.pem" 2>/dev/null || echo none; }
    last="$(cert_state)"
    while sleep 60; do
      now="$(cert_state)"
      if [ "$now" != "$last" ]; then
        last="$now"
        write_server_conf
        nginx -s reload
      fi
    done
  ) &
fi
