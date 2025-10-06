#!/usr/bin/env bash
set -e

# Render setzt $PORT; lokal fallback 8080
export PORT="${PORT:-8080}"

# Template → echte Config (nur $PORT ersetzen, damit $uri etc. intakt bleiben)
envsubst '$PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

echo "NGINX listening on PORT=${PORT}"
exec "$@"
