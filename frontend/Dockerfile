# ---- Runtime (nginx) ----
FROM nginx:1.25-alpine

# Tools für envsubst (PORT → nginx-Config) + CRLF-Fix für Windows-Skripte
RUN apk add --no-cache bash gettext dos2unix

# Nginx-Template & Entrypoint kopieren (als root)
COPY ./nginx.conf.template /etc/nginx/templates/default.conf.template
COPY ./docker-entrypoint.sh /usr/local/bin/render-entrypoint.sh
RUN dos2unix /usr/local/bin/render-entrypoint.sh && chmod +x /usr/local/bin/render-entrypoint.sh

# Statisches Frontend kopieren
# (dank .dockerignore werden Dockerfiles & README etc. nicht mitkopiert)
COPY ./ /usr/share/nginx/html/

# Als root bleiben, damit wir /etc/nginx/conf.d/default.conf schreiben können.
# nginx selbst (master) läuft dann als root und spawnt worker als nginx-User.
ENTRYPOINT ["/usr/local/bin/render-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
