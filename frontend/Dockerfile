# ---- Stage: Runtime (nginx) ----
FROM nginx:1.25-alpine

# Tools für envsubst (PORT in nginx-Config einsetzen)
RUN apk add --no-cache bash gettext

# Statisches Frontend kopieren (Passe den Pfad an, falls dein Docker-Kontext anders ist)
COPY ./ /usr/share/nginx/html/

# Nginx-Template & Entrypoint kopieren
COPY ./nginx.conf.template /etc/nginx/templates/default.conf.template
COPY ./docker-entrypoint.sh /docker-entrypoint.sh

# Besitzer & Ausführrechte
RUN chmod +x /docker-entrypoint.sh \
    && chown -R nginx:nginx /usr/share/nginx/html

USER nginx

# Start: Template -> echte Config, dann nginx
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
