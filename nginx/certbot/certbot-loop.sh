#!/bin/sh
# Obtient puis renouvelle le certificat Let's Encrypt de $DOMAIN (challenge HTTP
# servi par nginx depuis le volume partagé). nginx recharge tout seul le certificat.
# Sans DOMAIN : ne fait rien (TLS géré par un proxy en amont, ex. Coolify).
trap 'exit 0' TERM INT

idle() { while :; do sleep 86400 & wait $!; done; }

if [ -z "${DOMAIN:-}" ]; then
  echo "certbot: DOMAIN non défini — HTTPS intégré désactivé"
  idle
fi

if [ -n "${LETSENCRYPT_EMAIL:-}" ]; then
  account="--email $LETSENCRYPT_EMAIL"
else
  account="--register-unsafely-without-email"
fi

# Laisser nginx démarrer
sleep 10 & wait $!

while :; do
  # --keep-until-expiring : obtient le certificat, ou le renouvelle s'il expire dans moins de 30 jours
  if certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" $account \
      --agree-tos --non-interactive --keep-until-expiring; then
    delay=43200   # 12 h
  else
    echo "certbot: échec — vérifier que $DOMAIN pointe vers ce serveur et que le port 80 est ouvert"
    delay=3600    # 1 h (limite Let's Encrypt : 5 échecs / heure)
  fi
  sleep "$delay" & wait $!
done
