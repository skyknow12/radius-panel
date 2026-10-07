-- =============================================================================
-- Migration 005: Phase 4 — ISP Network Control, NOC & RADIUS Operations
-- =============================================================================

-- 1. Multi-Duration Package Pricing Table
CREATE TABLE IF NOT EXISTS package_prices (
  id               SERIAL PRIMARY KEY,
  package_id       INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  duration_months  INTEGER NOT NULL CHECK (duration_months > 0),
  price            NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  currency         VARCHAR(8) NOT NULL DEFAULT 'NPR',
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (package_id, duration_months)
);

CREATE INDEX IF NOT EXISTS package_prices_package_id_idx ON package_prices (package_id);

DROP TRIGGER IF EXISTS package_prices_updated_at ON package_prices;
CREATE TRIGGER package_prices_updated_at BEFORE UPDATE ON package_prices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed standard 1, 3, 6, 12 month pricing for existing packages
INSERT INTO package_prices (package_id, duration_months, price, currency)
SELECT p.id, 1, p.price, p.currency FROM packages p
ON CONFLICT (package_id, duration_months) DO NOTHING;

INSERT INTO package_prices (package_id, duration_months, price, currency)
SELECT p.id, 3, ROUND(p.price * 2.85, 2), p.currency FROM packages p
ON CONFLICT (package_id, duration_months) DO NOTHING;

INSERT INTO package_prices (package_id, duration_months, price, currency)
SELECT p.id, 6, ROUND(p.price * 5.40, 2), p.currency FROM packages p
ON CONFLICT (package_id, duration_months) DO NOTHING;

INSERT INTO package_prices (package_id, duration_months, price, currency)
SELECT p.id, 12, ROUND(p.price * 10.00, 2), p.currency FROM packages p
ON CONFLICT (package_id, duration_months) DO NOTHING;

-- 2. Recharge Transactions Table
CREATE TABLE IF NOT EXISTS recharge_transactions (
  id               SERIAL PRIMARY KEY,
  receipt_no       VARCHAR(32) NOT NULL UNIQUE,
  subscriber_id    INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  package_id       INTEGER NOT NULL REFERENCES packages(id) ON DELETE RESTRICT,
  duration_months  INTEGER NOT NULL CHECK (duration_months > 0),
  amount           NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  currency         VARCHAR(8) NOT NULL DEFAULT 'NPR',
  payment_method   VARCHAR(32) NOT NULL DEFAULT 'Cash',
  recharge_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  previous_expiry  TIMESTAMPTZ,
  new_expiry       TIMESTAMPTZ NOT NULL,
  created_by       VARCHAR(64) NOT NULL DEFAULT 'admin',
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recharge_transactions_sub_idx ON recharge_transactions (subscriber_id);
CREATE INDEX IF NOT EXISTS recharge_transactions_date_idx ON recharge_transactions (recharge_date);
CREATE INDEX IF NOT EXISTS recharge_transactions_pkg_idx ON recharge_transactions (package_id);

-- 3. Extend nas_devices for NOC telemetry and testing
ALTER TABLE nas_devices
  ADD COLUMN IF NOT EXISTS auth_port INTEGER NOT NULL DEFAULT 1812,
  ADD COLUMN IF NOT EXISTS acct_port INTEGER NOT NULL DEFAULT 1813,
  ADD COLUMN IF NOT EXISTS last_response_time_ms INTEGER NULL,
  ADD COLUMN IF NOT EXISTS last_error TEXT NULL,
  ADD COLUMN IF NOT EXISTS last_auth_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS last_acct_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS is_test_nas BOOLEAN NOT NULL DEFAULT FALSE;

-- 4. Extend ip_pools for IPv6 & Reserved counts
ALTER TABLE ip_pools
  ADD COLUMN IF NOT EXISTS pool_type VARCHAR(8) NOT NULL DEFAULT 'ipv4' CHECK (pool_type IN ('ipv4', 'ipv6')),
  ADD COLUMN IF NOT EXISTS prefix_length INTEGER DEFAULT 32,
  ADD COLUMN IF NOT EXISTS reserved_ips INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dns_servers TEXT NULL;

-- 5. Session Actions (CoA / Disconnect execution history)
CREATE TABLE IF NOT EXISTS session_actions (
  id                 SERIAL PRIMARY KEY,
  subscriber_id      INTEGER REFERENCES subscribers(id) ON DELETE SET NULL,
  username           VARCHAR(64) NOT NULL,
  session_id         VARCHAR(64),
  nas_ip             INET,
  action             VARCHAR(32) NOT NULL, -- 'disconnect', 'coa_rate_limit', 'suspend', 'resume'
  vendor             VARCHAR(32) NOT NULL DEFAULT 'Generic', -- 'MikroTik', 'Juniper', 'Cisco', 'Generic'
  status             VARCHAR(16) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'NOT SUPPORTED', 'TIMEOUT')),
  details            TEXT,
  operator_username  VARCHAR(64) NOT NULL DEFAULT 'admin',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS session_actions_username_idx ON session_actions (lower(username));
CREATE INDEX IF NOT EXISTS session_actions_date_idx ON session_actions (created_at);

-- 6. Centralized Network Events Table
CREATE TABLE IF NOT EXISTS network_events (
  id          SERIAL PRIMARY KEY,
  event_type  VARCHAR(64) NOT NULL,
  severity    VARCHAR(16) NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  actor       VARCHAR(64) NOT NULL DEFAULT 'system',
  target      VARCHAR(128),
  description TEXT NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS network_events_type_idx ON network_events (event_type);
CREATE INDEX IF NOT EXISTS network_events_created_at_idx ON network_events (created_at DESC);
CREATE INDEX IF NOT EXISTS network_events_severity_idx ON network_events (severity);

-- 7. System & NOC Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
  id           SERIAL PRIMARY KEY,
  severity     VARCHAR(16) NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  title        VARCHAR(128) NOT NULL,
  description  TEXT NOT NULL,
  source       VARCHAR(64) NOT NULL DEFAULT 'system',
  status       VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ,
  resolved_by  VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS alerts_status_idx ON alerts (status);
CREATE INDEX IF NOT EXISTS alerts_severity_idx ON alerts (severity);
CREATE INDEX IF NOT EXISTS alerts_created_at_idx ON alerts (created_at DESC);

-- Seed initial test events and alerts
INSERT INTO network_events (event_type, severity, actor, target, description, created_at)
VALUES
  ('system.boot', 'info', 'system', 'FreeRADIUS', 'RADIUS PRO NOC engine initialised successfully', NOW() - INTERVAL '2 hours'),
  ('nas.healthcheck', 'info', 'system', 'FW-BNG-01', 'NAS connection verified via Status-Server probe', NOW() - INTERVAL '1 hour'),
  ('ippool.check', 'info', 'system', 'FW-POOL-100', 'IP Pool utilization within normal parameters (1.2% allocated)', NOW() - INTERVAL '30 minutes')
ON CONFLICT DO NOTHING;

INSERT INTO alerts (severity, title, description, source, status, created_at)
VALUES
  ('info', 'System Operational', 'All FreeRADIUS authentication and accounting daemons are healthy.', 'system', 'active', NOW() - INTERVAL '2 hours')
ON CONFLICT DO NOTHING;

-- 8. Additional Permissions for Phase 4
INSERT INTO permissions (key, module, description) VALUES
  ('recharge.create',     'recharge', 'Process subscriber recharges and renewals'),
  ('recharge.view',       'recharge', 'View subscriber recharge history and revenue records'),
  ('alerts.manage',       'alerts',   'Acknowledge and resolve NOC operational alerts'),
  ('network_events.view', 'noc',      'View centralized network events timeline'),
  ('reports.view',        'reports',  'Generate and export NOC analytical reports'),
  ('noc.view',            'noc',      'Access dedicated NOC operational dashboard'),
  ('coa.execute',         'radius',   'Execute RFC 3576 / RFC 5176 Disconnect and CoA packets'),
  ('nas.test',            'nas',      'Execute safe test probes against TEST NAS devices')
ON CONFLICT (key) DO NOTHING;

-- Grant permissions to super_admin and admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
  AND p.key IN (
    'recharge.create', 'recharge.view', 'alerts.manage',
    'network_events.view', 'reports.view', 'noc.view',
    'coa.execute', 'nas.test'
  )
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('admin', 'operator')
  AND p.key IN (
    'recharge.create', 'recharge.view', 'alerts.manage',
    'network_events.view', 'reports.view', 'noc.view',
    'nas.test'
  )
ON CONFLICT DO NOTHING;
