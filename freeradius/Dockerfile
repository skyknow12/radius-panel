# =============================================================================
#  RADIUS PRO — FreeRADIUS 3.2 image
#  Based on the official FreeRADIUS image with our configuration layered on top.
# =============================================================================
FROM freeradius/freeradius-server:latest-3.2

ENV RADDB=/etc/freeradius

# Clients (NAS) allowed to talk to this server
COPY clients.conf ${RADDB}/clients.conf

# Local users file (development test user lives here)
COPY users ${RADDB}/mods-config/files/authorize

# PostgreSQL SQL module
COPY mods-enabled/sql ${RADDB}/mods-available/sql

# Virtual server handling auth / acct
COPY sites-enabled/default ${RADDB}/sites-available/default

RUN set -eux; \
    ln -sf ../mods-available/sql ${RADDB}/mods-enabled/sql; \
    ln -sf ../sites-available/default ${RADDB}/sites-enabled/default; \
    chown -R freerad:freerad ${RADDB} 2>/dev/null || true; \
    chmod 640 ${RADDB}/clients.conf ${RADDB}/mods-available/sql

EXPOSE 1812/udp 1813/udp

# -f : foreground, -l stdout : log to container stdout
CMD ["freeradius", "-l", "stdout"]
