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

### 7. Access Dashboard & Sign In
Navigate in your browser to:
```text
http://<SERVER-IP>          # Standard HTTP (Port 80)
https://<SERVER-IP>         # Secure HTTPS (Port 443, SSL enabled)
http://<SERVER-IP>:3000     # Direct Next.js access
```
The application opens directly to the **Administrative Sign In** page.
Log in using:
- **Username / Email**: `admin` (or the `ADMIN_EMAIL` configured in `.env`)
- **Password**: Defined in `ADMIN_PASSWORD` in your `.env` (default template: `admin123`)

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

---

## Phase 2 — Real ISP Operations & MikroTik Integration

Phase 2 elevates the platform into an enterprise-grade ISP RADIUS management system with real SQL-backed authentication, bandwidth throttling, accounting, and disconnect automation.

### MikroTik RouterOS Configuration Guide

To configure your MikroTik BNG / PPPoE / Hotspot router to authenticate against this RADIUS server:

#### 1. Add RADIUS Client
Replace `<RADIUS_SERVER_IP>` with your server IP and `<YOUR_NAS_SECRET>` with the secret entered in **RADIUS → NAS Devices**:
```routeros
/radius add service=ppp,hotspot \
    address=<RADIUS_SERVER_IP> \
    secret="<YOUR_NAS_SECRET>" \
    authentication-port=1812 \
    accounting-port=1813 \
    timeout=3000ms \
    comment="SKY RADIUS Main AAA"
```

#### 2. Enable RADIUS Incoming (RFC 3576 Disconnect / CoA)
This allows the panel to disconnect users or apply speed changes in real-time:
```routeros
/radius incoming set accept=yes port=3799
```

#### 3. Enable RADIUS on PPP / PPPoE Server
Enable interim accounting updates so live bandwidth graphs and online sessions stay synchronized:
```routeros
/ppp aaa set use-radius=yes \
    accounting=yes \
    interim-update=5m
```

#### 4. Configure PPPoE Server Profile
```routeros
/interface pppoe-server server add \
    service-name=SKY-FIBER \
    interface=ether2 \
    default-profile=default \
    one-session-per-host=yes \
    disabled=no
```

---

## Phase 3 — ISP Service Management Features

The system extends ISP management with full lifecycle service operations:

### 1. Comprehensive Subscriber Profiles
- **Profile Header**: Quick overview of customer ID, status badge, active plan, connection type (PPPoE, IPoE, Static IP), and live online state.
- **Service Lifecycle History**: Retains historical service records (`subscriber_services`) across plan changes and upgrades with start/expiry dates and IP assignments.
- **Connection Details**: VLAN ID, MAC address, OLT PON port, ONU MAC/Serial, ONU Model, and IPv6 prefix `/64` or `/56` delegation.
- **Usage & Telemetry**: Aggregated download/upload volume metrics, 7-day usage trends, and session history directly linked to FreeRADIUS `radacct`.
- **Staff Notes & Timeline**: Internal NOC staff notes with timestamps, alongside automated audit timeline tracking for package changes, status toggles, and CoA requests.

### 2. IP Pools & Static IP Inventory
- **IP Pool Management**: Subnet/CIDR pool tracking (`ip_pools`), gateway assignment, IP range, and live utilization calculation.
- **Static IP Collision Protection**: Database-level partial unique index ensuring no two active subscribers can be assigned colliding static IPv4 addresses while permitting historical IP reuse.
- **IP Address Inventory**: Allocation view showing assigned, available, and reserved IPs with subscriber linkages.

### 3. RADIUS Attribute Engine & Profile Templates
- **Generic Attribute Store**: Standard FreeRADIUS check and reply attributes supporting any vendor dictionary (MikroTik, Cisco, Juniper, RFC standard).
- **Reusable Profiles**: Template groups (`radius_profiles` & `radius_attributes`) assignable to packages or individual subscriber plans.

### 4. Advanced Bandwidth & Burst Control
- **MikroTik Burst Limits**: Configurable burst download/upload speeds, burst thresholds, and burst durations automatically formatted into `Mikrotik-Rate-Limit` syntax (e.g., `100M/100M 150M/150M 80M/80M 16/16`).
- **Dynamic CoA Speed Updates**: Real-time CoA packet delivery (RFC 3576 / RFC 5176) to NAS devices upon subscriber package upgrade without service interruption.

### 5. Automated Expiry & Bulk Management
- **Background Expiry Daemon**: Automated scheduler (`autoExpiryService`) running periodic scans to mark expired services, update `radcheck` to reject expired logins, and log activity events.
- **Bulk Operations**: Bulk suspend, bulk resume, and bulk package change operations across filtered subscriber lists.
- **CSV Data Export**: Streamed NOC report generator exporting complete subscriber lists with IP, package, connection, and contact metadata.

---

## FreeRADIUS SQL Data Flow

```text
Subscriber Created / Modified (Web UI)
        │
        ├──> PostgreSQL `subscribers` & `packages`
        │
        ├──> PostgreSQL `radcheck` (Cleartext-Password, Expiration, Auth-Type)
        ├──> PostgreSQL `radreply` (Framed-IP-Address, Framed-IPv6-Prefix)
        ├──> PostgreSQL `radusergroup` (Group assignment)
        └──> PostgreSQL `radgroupreply` (Mikrotik-Rate-Limit, Acct-Interim-Interval)
        │
Access-Request (MikroTik / BNG) ──> FreeRADIUS (UDP 1812) ──> PostgreSQL (rlm_sql)
        │
        ├── Accept: returns Mikrotik-Rate-Limit (e.g. 100M/100M), Acct-Interim-Interval (300)
        └── Reject: returned immediately if invalid password, suspended, or expired
        │
Accounting-Start/Interim/Stop ──> FreeRADIUS (UDP 1813) ──> PostgreSQL `radacct`
        │
Disconnect / CoA (Web UI) ──> Backend RFC 3576 Client ──> NAS UDP 3799 (Disconnect-Request / CoA-Request)
```

---

## Verification & Testing Guide

### 1. Test Valid Subscriber Authentication
```bash
printf 'User-Name=radius-test\nUser-Password=ChangeMe123!\n' | \
  radclient -x 127.0.0.1:1812 auth testing123
```
*Expected Reply:*
`Received Access-Accept` containing `Mikrotik-Rate-Limit = "10M/10M"`, `Acct-Interim-Interval = 300`, and `Framed-IP-Address = 100.111.99.10`.

### 2. Test Suspended Subscriber
```bash
printf 'User-Name=suspended_user\nUser-Password=Suspend123\n' | \
  radclient 127.0.0.1:1812 auth testing123
```
*Expected Reply:*
`Received Access-Reject`.

### 3. Test Expired Subscriber
```bash
printf 'User-Name=expired_user\nUser-Password=Expired123\n' | \
  radclient 127.0.0.1:1812 auth testing123
```
*Expected Reply:*
`Received Access-Reject`.

---

## Troubleshooting

- **FreeRADIUS container fails to start:**
  Check logs: `docker compose logs freeradius`
  Verify PostgreSQL is ready and reachable on port 5432.
- **Access-Reject on radtest:**
  Verify password in `radcheck` table or subscriber details in the web UI.
- **Backend cannot reach FreeRADIUS:**
  Check `RADIUS_SECRET` in `.env` matches between backend and FreeRADIUS.
- **MikroTik Disconnect / CoA timeout:**
  Verify UDP port 3799 is open on your firewall and `/radius incoming set accept=yes port=3799` is enabled on RouterOS.

---

## Phase 4: ISP Network Control, NOC & RADIUS Operations

Phase 4 turns the platform into a carrier-grade ISP Network Operations Center (NOC) system:

### 1. Multi-Duration Package Pricing & Recharge
- Packages support independent pricing for **1 Month**, **3 Months**, **6 Months**, and **12 Months**.
- Recharge ledger tracks duration, amount, payment method, reference, and automatically recalculates expiry date from previous expiration or current timestamp.

### 2. NOC Operations Dashboard
- Live session counter, bandwidth consumption (Download/Upload), RADIUS authentication success/failure rates.
- FreeRADIUS & PostgreSQL daemon health metrics.
- Active live sessions table with real-time CoA disconnect action.
- Direct quick links and interactive drill-down navigation.

### 3. Vendor-Aware CoA / Disconnect Architecture
- Dedicated support for **MikroTik RouterOS**, **Juniper JunOS**, **Cisco IOS/IOS-XE**, and **RFC 3576 / RFC 5176 Generic** NAS gateways.
- Sends vendor-specific VSA attributes (`Mikrotik-Rate-Limit`, `ERX-Service-Activate`, `Cisco-AVPair`, etc.) or RFC 3576 Disconnect-Request / PoD packets.
- Action logs recorded to `session_actions` and `network_events`.

### 4. Network Events & NOC Alerts
- Centralized event bus logging all operational actions (logins, session disconnects, speed modifications, recharges, failovers).
- Alert management with severity levels (`critical`, `warning`, `info`), acknowledgement, and resolution workflows.

### 5. Reporting & CSV Export
- Period aggregation (Today, 7 Days, 30 Days, 90 Days) for recharge revenue, session accounting, and subscriber growth.
- One-click streaming CSV exports for subscribers, transactions, and session history.

### 6. Global Search & Interactive Navigation
- `⌘K` / `Ctrl+K` global search modal indexing subscribers, active sessions, NAS gateways, packages, and IP addresses.
- Usernames are clickable everywhere (Dashboard, Online Users, Session Tables, Auth Logs, Reports) opening the full subscriber profile with service management and recharge history.

