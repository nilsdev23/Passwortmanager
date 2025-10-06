#!/usr/bin/env bash
set -e

# PORT in Template einsetzen -> echte Nginx-Config
# Nur explizit PORT ersetzen, um Nginx-Variablen ($uri etc.) nicht zu zerstören
export PORT="${PORT:-8080}"
envsubst '$PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# Anzeigen, welche Port-Konfig aktiv ist (Debug)
echo "NGINX listening on PORT=${PORT}"
cat /etc/nginx/conf.d/default.conf

# Übergabe an Container CMD (nginx -g 'daemon off;')
exec "$@"
