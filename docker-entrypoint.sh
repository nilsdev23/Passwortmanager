#!/usr/bin/env bash
set -e

# Render setzt $PORT; lokal Fallback 8080
export PORT="${PORT:-8080}"

# Nur $PORT ersetzen (keine Bash-Expansionen im Template)
envsubst '$PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

echo "NGINX listening on PORT=${PORT}"
exec "$@"
