FROM nginx:1.25-alpine

# Tools: envsubst + CRLF-Fix für Windows-Skripte
RUN apk add --no-cache bash gettext dos2unix

# Nginx-Template & Entrypoint
COPY ./nginx.conf.template /etc/nginx/templates/default.conf.template
COPY ./docker-entrypoint.sh /usr/local/bin/render-entrypoint.sh
RUN dos2unix /usr/local/bin/render-entrypoint.sh && chmod +x /usr/local/bin/render-entrypoint.sh

# Statisches Frontend (alles außer via .dockerignore ausgeschlossen)
COPY ./ /usr/share/nginx/html/

# Entrypoint rendert die Port-Config und startet nginx
ENTRYPOINT ["/usr/local/bin/render-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
