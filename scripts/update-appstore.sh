#!/usr/bin/env bash
# Usage : scripts/update-appstore.sh v1.2.3 chemin/vers/appstore
# Fait pointer Apps/Obscura du store ZimaOS sur une version publiée.
set -euo pipefail

TAG=$1
COMPOSE=$2/Apps/Obscura/docker-compose.yml
VERSION=${TAG#v}
DATE=$(date -u +%Y-%m-%d)

if [[ ! $TAG =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Pas une version stable : $TAG" >&2
  exit 1
fi

perl -pi -e "
  s{(image: ghcr\.io/arayan48/obscura:)\S+}{\${1}$TAG};
  s{^(  version: )\"[^\"]*\"}{\${1}\"$VERSION\"};
  s{^(  update_at: )\"[^\"]*\"}{\${1}\"$DATE\"};
" "$COMPOSE"

grep -q "obscura:$TAG" "$COMPOSE"
grep -q "version: \"$VERSION\"" "$COMPOSE"
