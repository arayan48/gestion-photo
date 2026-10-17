#!/bin/sh
set -e

# Lancé en root : rend les volumes à l'utilisateur `node` (données créées par une
# version précédente qui tournait en root), puis abandonne les droits root.
if [ "$(id -u)" = "0" ]; then
  NODE_UID="$(id -u node)"
  for dir in "${STORAGE_PATH:-/app/storage}" "$(dirname "${MASTER_KEY_FILE:-/app/data/master.key}")"; do
    mkdir -p "$dir"
    if [ "$(stat -c %u "$dir")" != "$NODE_UID" ]; then
      echo "Attribution de $dir à l'utilisateur node…"
      chown -R node:node "$dir"
    fi
  done
  exec su-exec node "$@"
fi

exec "$@"
