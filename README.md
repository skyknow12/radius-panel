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

---

## Phase 5: Core Billing, Recharge & Financial Management

Phase 5 builds a complete subscriber billing, recharge, and financial ledger platform designed for ISP commercial operations:

### 1. Accounting Ledger & Revenue Formula
- **Net Revenue Formula**: `Net Revenue = Gross Revenue − Discounts − Refunds`
- Revenue is strictly calculated from `COMPLETED` transactions. `PENDING`, `CANCELLED`, and `FAILED` transactions are never counted as revenue.
- Every recharge generates an immutable financial transaction and matching invoice.

### 2. Multi-Duration Package Pricing & Audit History
- Every package supports independent prices for **1 Month**, **3 Months**, **6 Months**, **12 Months**, and custom durations (e.g. 2, 9, 18, 24 months).
- Prices are never derived automatically; each duration is stored and configured independently.
- `package_price_history` tracks all price modifications: old price, new price, package, duration, changed by, timestamp, and reason.
- Historical transactions retain their immutable purchase price even if package prices change later.

### 3. Transactional Recharge Engine & Double-Recharge Protection
- Complete ACID transactional execution (`BEGIN ... COMMIT / ROLLBACK`):
  1. Validates subscriber, package, duration, and price.
  2. Applies and validates discounts against operator permission limits.
  3. Calculates new expiration date (adds duration from existing valid expiry if subscriber is active, or from current timestamp if expired).
  4. Creates unique transaction ID (`REC-YYYYMMDD-XXXX`) and invoice (`INV-YYYYMMDD-XXXX`).
  5. Updates subscriber status, package, and expiry date.
  6. Updates FreeRADIUS `radcheck` Expiration attribute and removes any `Auth-Type := Reject`.
  7. Inserts `subscriber_services`, `subscriber_activity`, `network_events`, and audit logs.
- **Double-Recharge Protection**: Enforces client-side submit lock and unique `idempotency_key` verification to prevent duplicate payment submissions.

### 4. Configurable Payment Methods & References
- Database-backed `payment_methods` table with active toggles and reference requirement flags:
  - **Cash** (Counter receipt, optional reference)
  - **Bank Transfer** (Deposit slip / voucher reference required)
  - **QR / Fonepay** (Instant scan with transaction ID required)
  - **Digital Wallet** (eSewa / Khalti / IME Pay reference)
  - **Cheque** (Cheque number required)
  - **Complimentary / Staff** (Authorized internal service)

### 5. Financial Discounts & RBAC Permissions
- Supports fixed amount (NPR) and percentage (%) discounts.
- Role-based discount caps enforced on the backend:
  - `operator`: Maximum 5% discount
  - `admin`: Maximum 15% discount
  - `super_admin`: Unlimited / configurable
- Granular billing permissions: `billing.view`, `billing.recharge`, `billing.discount`, `billing.adjustment`, `billing.refund`, `billing.invoice`, `billing.receipt`, `billing.report`, `billing.export`, `billing.package_price`.

### 6. Refunds & Cancellations
- Completed transactions can be refunded (full or partial) with audit logging into `refunds`.
- Transaction status updates to `REFUNDED` or `PARTIALLY_REFUNDED`. Original records are never deleted.
- Pending transactions can be cancelled with mandatory reason logging.

### 7. Interactive Billing Dashboard
- 10 clickable metric cards:
  - Today's Revenue → Filtered transaction ledger
  - Monthly Revenue → Monthly financial report
  - Today's Recharges → Today's recharge list
  - Monthly Recharges → Monthly transaction list
  - Active Subscribers → Subscribers view
  - Expiring Today → Subscribers expiring today
  - Expiring in 7 Days → Upcoming expiry list
  - Expired Subscribers → Suspended/expired subscriber list
  - Pending Transactions → Pending capture queue
  - Refunds Issued → Refunds audit ledger
- Accounting summary card showing Gross, Discounts, Refunds, and Net Total Revenue.
- Recent 10 transactions table with clickable IDs, usernames, and quick receipt action.

### 8. Official Payment Receipts & Invoices
- Printable and downloadable payment receipt layout with ISP branding, subscriber information, breakdown of plan and discounts, previous & extended expiry dates, and payment reference.
- Built-in `@media print` styling for clean, professional paper printing or PDF export.

### 9. Expiry & Renewal Management View
- Dedicated lifecycle view with time-window pills: **Expiring Today**, **Expiring Tomorrow**, **In 3 Days**, **In 7 Days**, and **Already Expired**.
- Instant "Recharge" action on each row opening pre-filled recharge dialog for that subscriber.

### 10. Financial Reports & CSV Export
- Server-side aggregated reports: Daily Revenue, Monthly Revenue, Package Breakdown, Payment Channels, Discounts Given, Refunds Ledger, and Manual Adjustments.
- Streaming CSV exports for spreadsheet analysis and tax accounting.

---

## Phase 6: Organization, Branch, Reseller, Wallet, Credit & Commission

Phase 6 extends the platform into a multi-tier, multi-tenant ISP distribution and channel management system supporting hierarchical branches, reseller franchises, dedicated prepaid wallets, post-paid credit lines, and automated commission accounting.

### 1. Hierarchical Multi-Channel Architecture
The system supports a 3-tier operational hierarchy:
- **Head Office (HQ)**: Root enterprise organization overseeing all branches, partners, network gateways, and global financial transactions.
- **Branches**: Regional operating branches (e.g. Kathmandu Core, Pokhara Western, Lalitpur Hub) with designated branch managers, staff, subscribers, and dedicated operational wallets.
- **Resellers & Franchises**: Independent local ISP franchisees or sub-distributors operating on prepaid wallet or post-paid credit terms with automated commission earnings.

### 2. Subscriber Ownership & Transfer Audit Trail
- Every subscriber has an explicit ownership model: `head_office`, `branch`, or `reseller`.
- Subscribers display live channel badges in subscriber lists and management tables.
- **Ownership Transfer Engine**: Operators with `organization.manage` permission can reassign subscriber ownership between HQ, branches, and resellers.
- All transfers are immutably logged into `subscriber_ownership_history` tracking `from_type`, `to_type`, `from_id`, `to_id`, `reason`, `transferred_by`, and timestamp.

### 3. Immutable Wallet Ledger & Credit Lines
- **Dedicated Wallets**: Every branch and reseller partner has a dedicated financial wallet tracked in `wallets`.
- **Double-Entry Ledger**: Every balance mutation creates an immutable record in `wallet_transactions` tracking:
  - `opening_balance` & `closing_balance`
  - Transaction types: `topup`, `recharge_deduction`, `commission_payout`, `adjustment`, `refund`
  - Audit trail: `reference`, `notes`, `created_by`, `created_at`
- **Super Admin Cash Top-Up**:
  - Wallets can only be funded through authorized Super Admin cash top-up (`POST /api/wallets/:id/topup`).
  - Branch and reseller operators are prohibited from topping up their own wallets.
- **Post-Paid Credit Accounts**:
  - Partners can be assigned a revolving credit facility (`credit_accounts`) with configurable `credit_limit`, `used_credit`, and `expiry_date`.
  - Recharge transactions debit available cash first; if cash is insufficient, the remainder is drawn from the active credit line.
  - Transactions fail atomically if combined cash and available credit are insufficient.
- **Manual Balance Adjustments**: Super Admins can issue audited balance adjustments with mandatory rationale.

### 4. Channel Pricing & Commission Rules
- Configurable rules in `channel_pricing_rules` determine wholesale package costs and partner incentives:
  - **Wholesale Discounts**: Percentage discounts (e.g. 15% wholesale discount) or fixed NPR discounts off standard retail rates.
  - **Partner Commissions**: Automated commission rates credited to reseller wallets or recorded in commission ledgers upon subscriber recharge.
  - **Duration Multipliers**: Custom wholesale pricing rules for 1, 3, 6, and 12-month packages.
- **Interactive Pricing Simulator**: Built-in pricing calculator tool allowing administrators to preview exact channel margins, wallet deductions, and partner commissions in real-time.

### 5. Transactional Channel Recharge Engine
- When a reseller or branch operator initiates a subscriber recharge:
  1. Verifies channel partner status, wallet balance, and active credit line.
  2. Calculates net wholesale deduction and partner commission according to active channel pricing rules.
  3. Atomically debits partner wallet / credit line in a single PostgreSQL ACID transaction.
  4. Extends subscriber validity and updates FreeRADIUS expiration and accounting attributes.
  5. Records commission earnings and generates transaction invoice.
- **Double-Recharge Protection**: Client-side submission guards and unique transaction idempotency keys prevent duplicate wallet debits.

### 6. Granular Dashboards & Reporting
- **Organization HQ Dashboard**: 10 clickable operational cards (Total Branches, Resellers, Channel Subscribers, Network Wallets, Total Wallet Cash, Allocated Credit, Channel Revenue, Accrued Commissions, Overdue Accounts, Pending Transfers) with live channel launchers and organization profile controls.
- **Branch Management View**: Complete branch inventory, contact information, subscriber metrics, and performance analytics.
- **Reseller Management View**: Reseller directory, commission schemes, billing models, and partner onboarding.
- **Wallets & Credit View**: Financial overview, partner wallet balances, transaction ledgers, credit controls, top-up modal, and balance adjustment tools.
- **Reseller Commission Report**: Aggregated partner commissions with search, date filters, summary KPI cards, and streaming CSV export.
- **Wallet Ledger CSV Export**: Export complete transaction history for accounting audits.

### 7. Backend Data Isolation & RBAC
- Built-in roles:
  - `super_admin`: Full system access across all organizations, branches, and resellers.
  - `branch_admin`: Scoped exclusively to their assigned branch and its subscribers.
  - `branch_operator`: Day-to-day operations for branch subscribers.
  - `reseller_admin`: Scoped exclusively to their franchise, wallet, and customer base.
  - `reseller_operator`: Recharge and view permissions for reseller subscribers.
- **Strict Data Isolation**: Multi-tenant isolation is enforced at the database and API query layer, ensuring partner accounts cannot view or modify unauthorized branches or subscribers.

---

## Phase 7: CRM, Customer Support, Notifications & User Management

Phase 7 introduces enterprise customer relationship management, helpdesk ticketing, SLA compliance tracking, granular database-driven RBAC, and in-app system notifications.

### 1. User Management & Session Governance
- **Full Staff CRUD**: Administer staff accounts with full names, phone numbers, emails, assigned organizations/branches/resellers, and status controls (`ACTIVE`, `INACTIVE`, `SUSPENDED`).
- **Immediate Session Invalidation**:
  - `forceLogout` increments `users.token_version` and marks all active records in `login_sessions` as revoked (`is_revoked = TRUE`).
  - Active JWT sessions carrying older token versions are immediately rejected at the API middleware layer.
- **Password Governance**:
  - Secure bcrypt password hashing with min length and complexity checks.
  - `force_password_reset` flag requiring operators to update credentials on subsequent login.
- **Login History Audit**: Every login attempt (Success, Failed credentials, Locked) is logged to `login_history` with IP address, user agent, and failure reason.
- **Active Session Tracking**: View active user sessions with IP address, browser agent, last active timestamp, and instant remote revocation.

### 2. Database-Driven RBAC & Data Scope
- **Dynamic Roles & Permissions**:
  - System roles (`SUPER_ADMIN`, `ORG_ADMIN`, `NOC_HEAD`, `NOC_OPERATOR`, `BILLING_ADMIN`, `BRANCH_ADMIN`, `BRANCH_OPERATOR`, `RESELLER_ADMIN`, `RESELLER_OPERATOR`, `SUPPORT_OPERATOR`, `READ_ONLY`) and arbitrary custom roles.
  - Action-level permissions catalog grouped by module: Subscribers, RADIUS/NAS, Billing/Wallets, Branches/Resellers, Tickets/CRM, Users/RBAC, and System Settings.
  - Multi-role assignment: Users assigned multiple roles automatically receive the SQL union of all permissions.
- **Data Scopes**:
  - `GLOBAL`: Unrestricted visibility across all branches, resellers, and subscribers.
  - `ORGANIZATION`: Scoped to designated organization entities.
  - `BRANCH`: Automatically constrained to users, subscribers, and wallets belonging to the branch.
  - `RESELLER`: Constrained to franchise partner subscribers, wallets, and tickets.
  - `OWN`: Operator-only records.

### 3. Customer CRM & Unified Touchpoints
- **Clean Subscriber Extension**: Fully integrates with existing subscriber database entities without duplicate customer records.
- **CRM Notes**:
  - Pinned notes feature: Critical customer notices (e.g. VIP, high-value corporate link, chronic fiber cuts) stay pinned to the top of profile notes.
  - Delete and audit tracking for staff notes.
- **Activity Timeline**:
  - Centralized customer activity log (`customer_activities`) tracking recharges, plan changes, suspension, tickets, and authentication anomalies.
- **Customer Communications**:
  - Multi-channel communication logger (`customer_communications`) recording interactions across `CALL`, `SMS`, `WHATSAPP`, `EMAIL`, and `IN_APP`.

### 4. Helpdesk & Support Ticketing
- **Ticket Lifecycle**:
  - Managed states: `OPEN` → `IN_PROGRESS` → `WAITING_CUSTOMER` → `WAITING_INTERNAL` → `RESOLVED` → `CLOSED` (or `REOPENED`).
  - 14 ISP Categories: Connectivity Issues, Slow Speed, High Latency, Physical Fiber Cut, ONT/Router Malfunction, Optical Power Low, IP Allocation Issue, Billing Dispute, Payment Verification, Package Upgrade, Address Relocation, Plan Cancellation, Port Configuration, and General Inquiry.
- **Dual-Thread Discussion**:
  - Staff internal notes (private to team) vs Public comments (customer-facing).
- **Technician Assignment**: Assign tickets to specific operators with instant assignment notifications.
- **Escalation Framework**:
  - Multi-level priority escalation (`LOW` → `MEDIUM` → `HIGH` → `CRITICAL`).
  - Mandatory justification prompt logged to immutable `ticket_escalations` audit trail.

### 5. Service Level Agreement (SLA) Engine
- **Configurable Thresholds**:
  - `CRITICAL` (P1): 1 hr response / 4 hr resolution.
  - `HIGH` (P2): 2 hr response / 8 hr resolution.
  - `MEDIUM` (P3): 4 hr response / 24 hr resolution.
  - `LOW` (P4): 8 hr response / 48 hr resolution.
- **Automated Deadline Tracking**:
  - Deadlines calculated dynamically from active SLA policies upon ticket creation (`NOW() + resolution_time_hours`).
  - Near-breach (< 2 hours remaining) warnings highlighted in amber across NOC views.
  - Overdue tickets flagged in pulsing red as `BREACHED SLA`.

### 6. Notifications & Global Navigation
- **In-App Notification Engine**:
  - Real-time notification generation on ticket events, SLA warnings, and account state modifications.
  - Topbar bell icon with unread badge counter, notification drawer, single-click mark-read, and mark-all-read.
- **Unified Global Search**:
  - Search modal (`⌘K`) indexes support tickets (by ticket number, subject) and staff users (by username, full name) alongside subscribers, IPs, NAS devices, branches, and transactions.




