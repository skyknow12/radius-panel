#!/bin/bash
set -e

# If SSL certificate and key do not exist, generate self-signed certificate for immediate HTTPS support
if [ ! -f /etc/nginx/ssl/cert.pem ] || [ ! -f /etc/nginx/ssl/key.pem ]; then
  echo "==> Generating self-signed SSL certificate for HTTPS (port 443)..."
  mkdir -p /etc/nginx/ssl
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/key.pem \
    -out /etc/nginx/ssl/cert.pem \
    -subj "/C=NP/ST=Bagmati/L=Kathmandu/O=SkyRadius/OU=NOC/CN=radius-panel"
  chmod 600 /etc/nginx/ssl/key.pem
  chmod 644 /etc/nginx/ssl/cert.pem
fi

echo "==> Starting Nginx reverse proxy on ports 80 and 443..."
exec "$@"
