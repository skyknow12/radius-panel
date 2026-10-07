# ISP RADIUS Management Panel

A modern ISP/RADIUS management platform with FreeRADIUS 3.2, PostgreSQL 16, backend REST API, and web NOC dashboard.

Designed specifically for Internet Service Providers (ISPs), Network Operation Centers (NOCs), and broadband network engineers managing high-density subscriber authentication and network telemetry.

---

## Architecture Overview

```text
                                 [ Browser Clients ]
                                          │
                                          ▼
                               ┌──────────────────────┐
                               │ Frontend (Next.js)   │
                               │ Port: 3000 (HTTP)    │
                               └──────────┬───────────┘
                                          │  /api/ rewrite
                                          ▼
                               ┌──────────────────────┐
                               │ Backend (Express/TS) │
                               │ Port: 4000 (Internal)│
                               └─────┬──────────┬─────┘
                                     │          │
             Status-Server / PAP UDP │          │ SQL Queries
          (Ports: 1812 / 1813 UDP)   │          │ (TCP 5432)
                                     ▼          ▼
                        ┌──────────────────┐  ┌──────────────────┐
                        │ FreeRADIUS 3.2   ├──┤ PostgreSQL 16    │
                        │ (rlm_sql_postgres│  │ (radacct,        │
                        │ BlastRADIUS prot)│  │  radpostauth...) │
                        └──────────────────┘  └──────────────────┘
```

### Components
1. **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide icons, Recharts, dark/light theme switching.
2. **Backend**: Node.js 22, Express, TypeScript, Zod validation, JWT authentication, rate limiting, and dependency-free RFC 2865/5997 UDP client.
3. **Database**: PostgreSQL 16 with standard FreeRADIUS SQL schema (`radcheck`, `radreply`, `radacct`, `radpostauth`, `nas`) and application RBAC schema (`users`, `roles`, `permissions`, `nas_devices`, `audit_logs`).
4. **RADIUS**: FreeRADIUS 3.2 with `rlm_sql_postgresql` driver, BlastRADIUS (CVE-2024-3596) Message-Authenticator protection, and Status-Server probes.

---

## Server Requirements

- **Operating System**: Linux (Ubuntu 20.04/22.04/24.04, Debian 11/12, CentOS/RHEL 9) or macOS
- **Hardware**: Minimum 2 CPU cores, 4 GB RAM, 20 GB SSD
- **Software**:
  - Docker Engine (v24.0+)
  - Docker Compose (v2.20+)
  - Git

*Note: Developers and sysadmins do not need to install Node.js, PostgreSQL, or FreeRADIUS on the host machine. All services run isolated within Docker containers.*

---

## Server Port Allocation

| Service | Port | Protocol | Scope | Description |
|---|---|---|---|---|
| **Frontend** | `3000` | TCP (HTTP) | Public / Reverse Proxy | NOC Web Dashboard |
| **RADIUS Auth** | `1812` | UDP | Public / NAS network | Access-Request / PAP / CHAP |
| **RADIUS Acct** | `1813` | UDP | Public / NAS network | Accounting Start / Interim / Stop |
| **Backend API** | `4000` | TCP (HTTP) | Localhost / Internal | REST API (probed by frontend) |
| **PostgreSQL** | `5432` | TCP | Localhost (127.0.0.1) | Database (not exposed publicly) |

---

## Environment Variables Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Key environment settings:

| Variable | Description | Default / Example |
|---|---|---|
| `APP_TIMEZONE` | Timezone for display and timestamps | `Asia/Kathmandu` |
| `POSTGRES_DB` | Database name | `radius` |
| `POSTGRES_USER` | Database username | `radius` |
| `POSTGRES_PASSWORD` | Database password | *Set secure string* |
| `JWT_SECRET` | Secret key for signing admin session tokens | *Generate via `openssl rand -hex 32`* |
| `ADMIN_USERNAME` | Bootstrap administrator login | `admin` |
| `ADMIN_PASSWORD` | Bootstrap administrator password | *Set secure string* |
| `RADIUS_SECRET` | Shared secret between backend probe and FreeRADIUS | *Set secure string* |
| `RADIUS_AUTH_PORT` | RADIUS Authentication port | `1812` |
| `RADIUS_ACCT_PORT` | RADIUS Accounting port | `1813` |
| `DATA_MODE` | Metrics data strategy (`hybrid`, `live`, `demo`) | `hybrid` |

---

## Production Installation

Follow these steps to deploy on a clean Linux production host:

### 1. Clone Repository
```bash
git clone <repository-url>
cd radius-panel
```

### 2. Configure Environment
```bash
cp .env.example .env
nano .env
```
Ensure you generate strong, unique passwords for `POSTGRES_PASSWORD`, `JWT_SECRET`, `ADMIN_PASSWORD`, and `RADIUS_SECRET`.

### 3. Start Containers
```bash
docker compose up -d
```

### 4. Verify Service Health
```bash
docker compose ps
```
All four containers (`radius-postgres`, `radius-freeradius`, `radius-backend`, `radius-frontend`) will report healthy/running status.

### 5. Inspect Service Logs
```bash
docker compose logs -f
```

### 6. Test FreeRADIUS Authentication
Run the standard RFC test command inside the container:
```bash
docker compose exec freeradius radtest testuser testpassword 127.0.0.1 0 testing123
```
**Expected Response:**
```text
Received Access-Accept Id 70 from 127.0.0.1:1812 ...
```

### 7. Access Dashboard
Navigate in your browser to:
```text
http://<SERVER-IP>:3000
```
Default credentials:
- **Username**: `admin`
- **Password**: Defined in `ADMIN_PASSWORD` in your `.env`

---

## FreeRADIUS Configuration & BlastRADIUS Protection

- **Clients configuration**: Defined in `freeradius/clients.conf`. Includes localhost test client (`testing123`) and internal Docker network client with environment-provided shared secret.
- **BlastRADIUS Mitigation**: Configured with `require_message_authenticator = yes` and `limit_proxy_state = yes` per RFC 3579 / CVE-2024-3596 guidelines.
- **PostgreSQL Accounting & Post-Auth**: Connected via `rlm_sql_postgresql` writing to `radacct` and `radpostauth`.
- **Status-Server Probes**: RFC 5997 Status-Server queries are enabled on both auth and acct sockets for zero-overhead liveness checking.

---

## Database Backup & Restore Procedure

### Backup Procedure
To generate a complete logical backup of the PostgreSQL schema and RADIUS tables:
```bash
docker compose exec postgres pg_dump -U radius -d radius > radius_backup_$(date +%F).sql
```
Compressing the backup:
```bash
gzip radius_backup_$(date +%F).sql
```

### Restore Procedure
To restore a backup into a fresh database:
```bash
docker compose exec -T postgres psql -U radius -d radius < radius_backup_2026-10-07.sql
```

---

## Health Checks & Diagnostics

The panel features a multi-layer health telemetry system:

- **API Endpoint**: `GET /api/health`
- **System Health Diagnostics**: `GET /api/system/health`
- **Interactive Probe Tool**: Click **`radtest Probe`** in the dashboard top navigation or **RADIUS Overview** to run real-time authentication probes and verify UDP round-trip latency directly from the web browser.

---

## Upgrade Procedure

To apply future updates or code revisions:
```bash
git pull origin main
docker compose build
docker compose up -d
```
All database tables, accounting sessions, and PostgreSQL state persist safely inside the `radius_postgres_data` Docker volume.

---

## Troubleshooting

- **FreeRADIUS container fails to start:**
  Check logs: `docker compose logs freeradius`
  Verify PostgreSQL is ready and reachable on port 5432.
- **Access-Reject on radtest:**
  Verify password in `freeradius/users` or `radcheck` table.
- **Backend cannot reach FreeRADIUS:**
  Check `RADIUS_SECRET` in `.env` matches between backend and FreeRADIUS.
