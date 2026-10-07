-- =============================================================================
-- Migration 004: Phase 3 — ISP Service & Subscriber Management
-- =============================================================================

-- 1. RADIUS Profiles Table (Reusable RADIUS attribute templates)
CREATE TABLE IF NOT EXISTS radius_profiles (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(64) NOT NULL UNIQUE,
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS radius_profiles_updated_at ON radius_profiles;
CREATE TRIGGER radius_profiles_updated_at BEFORE UPDATE ON radius_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. Generic RADIUS Attributes Engine Table
CREATE TABLE IF NOT EXISTS radius_attributes (
  id              SERIAL PRIMARY KEY,
  profile_id      INTEGER NOT NULL REFERENCES radius_profiles(id) ON DELETE CASCADE,
  vendor          VARCHAR(32) NOT NULL DEFAULT 'Standard', -- 'Standard', 'MikroTik', 'Cisco', 'Juniper'
  attribute_name  VARCHAR(64) NOT NULL,
  attribute_type  VARCHAR(32) NOT NULL DEFAULT 'string',   -- 'string', 'integer', 'ip', 'ipv6'
  op              VARCHAR(4) NOT NULL DEFAULT ':=',        -- ':=', '+=', '==', etc.
  value           TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS radius_attributes_profile_id_idx ON radius_attributes (profile_id);

-- 3. IP Pools Management Table
CREATE TABLE IF NOT EXISTS ip_pools (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(64) NOT NULL UNIQUE,
  network      CIDR NOT NULL,
  gateway      INET NOT NULL,
  start_ip     INET NOT NULL,
  end_ip       INET NOT NULL,
  subnet       VARCHAR(32) NOT NULL DEFAULT '255.255.0.0',
  description  TEXT,
  status       VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'exhausted')),
  total_ips    INTEGER NOT NULL DEFAULT 0,
  used_ips     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS ip_pools_updated_at ON ip_pools;
CREATE TRIGGER ip_pools_updated_at BEFORE UPDATE ON ip_pools
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. IP Addresses Allocation Table
CREATE TABLE IF NOT EXISTS ip_addresses (
  id               SERIAL PRIMARY KEY,
  pool_id          INTEGER REFERENCES ip_pools(id) ON DELETE SET NULL,
  ip_address       INET NOT NULL UNIQUE,
  subscriber_id    INTEGER REFERENCES subscribers(id) ON DELETE SET NULL,
  status           VARCHAR(16) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'reserved', 'blocked')),
  allocation_date  TIMESTAMPTZ,
  last_seen        TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ip_addresses_pool_id_idx ON ip_addresses (pool_id);
CREATE INDEX IF NOT EXISTS ip_addresses_subscriber_id_idx ON ip_addresses (subscriber_id);
CREATE INDEX IF NOT EXISTS ip_addresses_status_idx ON ip_addresses (status);

DROP TRIGGER IF EXISTS ip_addresses_updated_at ON ip_addresses;
CREATE TRIGGER ip_addresses_updated_at BEFORE UPDATE ON ip_addresses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. Extend Packages Table for Burst & RADIUS Profiles
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS burst_download_mbps INTEGER NULL,
  ADD COLUMN IF NOT EXISTS burst_upload_mbps INTEGER NULL,
  ADD COLUMN IF NOT EXISTS burst_threshold_dl_mbps INTEGER NULL,
  ADD COLUMN IF NOT EXISTS burst_threshold_ul_mbps INTEGER NULL,
  ADD COLUMN IF NOT EXISTS burst_time_seconds INTEGER NULL,
  ADD COLUMN IF NOT EXISTS radius_profile_id INTEGER REFERENCES radius_profiles(id) ON DELETE SET NULL;

-- 6. Extend Subscribers Table for Complete Profiles & Connection Info
-- Update status constraint: allow 'active', 'suspended', 'expired', 'disabled', 'pending', 'terminated', 'enabled'
ALTER TABLE subscribers DROP CONSTRAINT IF EXISTS subscribers_status_check;
ALTER TABLE subscribers ADD CONSTRAINT subscribers_status_check
  CHECK (status IN ('active', 'suspended', 'expired', 'disabled', 'pending', 'terminated', 'enabled'));

-- Normalise legacy 'enabled' to 'active'
UPDATE subscribers SET status = 'active' WHERE status = 'enabled';

ALTER TABLE subscribers
  ADD COLUMN IF NOT EXISTS connection_type VARCHAR(32) NOT NULL DEFAULT 'PPPoE',
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS area VARCHAR(64),
  ADD COLUMN IF NOT EXISTS branch VARCHAR(64),
  ADD COLUMN IF NOT EXISTS installation_date DATE,
  ADD COLUMN IF NOT EXISTS ip_pool_id INTEGER REFERENCES ip_pools(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ipv6_address INET,
  ADD COLUMN IF NOT EXISTS ipv6_prefix VARCHAR(64),
  ADD COLUMN IF NOT EXISTS ipv6_prefix_length INTEGER DEFAULT 64,
  ADD COLUMN IF NOT EXISTS olt_pon_port VARCHAR(64),
  ADD COLUMN IF NOT EXISTS onu_mac_sn VARCHAR(64),
  ADD COLUMN IF NOT EXISTS onu_model VARCHAR(64);

-- Unique partial index: static IP must be unique among active subscribers
CREATE UNIQUE INDEX IF NOT EXISTS subscribers_active_static_ip_idx
  ON subscribers (static_ip)
  WHERE static_ip IS NOT NULL AND status IN ('active', 'enabled');

-- 7. Subscriber Services & Service History Table
CREATE TABLE IF NOT EXISTS subscriber_services (
  id            SERIAL PRIMARY KEY,
  service_id    VARCHAR(32) NOT NULL UNIQUE,
  subscriber_id INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  package_id    INTEGER NOT NULL REFERENCES packages(id) ON DELETE RESTRICT,
  start_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expiry_date   TIMESTAMPTZ,
  status        VARCHAR(16) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'suspended', 'expired', 'disabled', 'pending', 'terminated')),
  nas_id        INTEGER REFERENCES nas_devices(id) ON DELETE SET NULL,
  ip_address    INET,
  ipv6_prefix   VARCHAR(64),
  created_by    VARCHAR(64) DEFAULT 'admin',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscriber_services_subscriber_id_idx ON subscriber_services (subscriber_id);
CREATE INDEX IF NOT EXISTS subscriber_services_status_idx ON subscriber_services (status);
CREATE INDEX IF NOT EXISTS subscriber_services_expiry_idx ON subscriber_services (expiry_date);

DROP TRIGGER IF EXISTS subscriber_services_updated_at ON subscriber_services;
CREATE TRIGGER subscriber_services_updated_at BEFORE UPDATE ON subscriber_services
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 8. Subscriber Notes Table (Staff internal collaboration)
CREATE TABLE IF NOT EXISTS subscriber_notes (
  id             SERIAL PRIMARY KEY,
  subscriber_id  INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  author_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name    VARCHAR(128) NOT NULL,
  content        TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscriber_notes_sub_idx ON subscriber_notes (subscriber_id);

-- 9. Subscriber Activity Timeline Table
CREATE TABLE IF NOT EXISTS subscriber_activity (
  id              SERIAL PRIMARY KEY,
  subscriber_id   INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  action          VARCHAR(64) NOT NULL,
  details         TEXT NOT NULL,
  admin_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  admin_username  VARCHAR(64),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscriber_activity_sub_idx ON subscriber_activity (subscriber_id);
CREATE INDEX IF NOT EXISTS subscriber_activity_time_idx ON subscriber_activity (created_at DESC);

-- 10. Extended Permissions for Phase 3
INSERT INTO permissions (key, module, description) VALUES
  ('subscribers.password', 'subscribers', 'Change subscriber password'),
  ('subscribers.change_package', 'subscribers', 'Change subscriber package and apply CoA'),
  ('subscribers.usage', 'subscribers', 'View subscriber bandwidth and usage analytics'),
  ('subscribers.export', 'subscribers', 'Export subscriber lists to CSV'),
  ('notes.manage', 'subscribers', 'Add and manage subscriber notes'),
  ('radius_profiles.view', 'radius', 'View RADIUS profiles and attributes'),
  ('radius_profiles.manage', 'radius', 'Create and modify RADIUS profiles and attributes')
ON CONFLICT (key) DO NOTHING;

-- Grant all permissions to super_admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- Grant standard operator permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('admin', 'operator')
  AND p.key IN (
    'subscribers.view', 'subscribers.edit', 'subscribers.suspend',
    'subscribers.password', 'subscribers.change_package', 'subscribers.usage',
    'subscribers.export', 'notes.manage', 'packages.view', 'radius_profiles.view', 'ippools.view'
  )
ON CONFLICT DO NOTHING;

-- 11. Seed Phase 3 Data: RADIUS Profiles, IP Pools, and Sample Services
INSERT INTO radius_profiles (id, name, description) VALUES
  (1, 'FIBER-100M', 'High-speed 100Mbps symmetrical profile with interim accounting'),
  (2, 'FIBER-200M', 'High-speed 200Mbps symmetrical profile with low latency'),
  (3, 'FIBER-50M',  'Standard 50Mbps residential broadband profile'),
  (4, 'TEST-10M',   'Quality assurance and diagnostics profile')
ON CONFLICT (id) DO NOTHING;
SELECT setval('radius_profiles_id_seq', (SELECT MAX(id) FROM radius_profiles));

INSERT INTO radius_attributes (profile_id, vendor, attribute_name, attribute_type, op, value) VALUES
  (1, 'MikroTik', 'Mikrotik-Rate-Limit', 'string', ':=', '100M/100M'),
  (1, 'Standard', 'Acct-Interim-Interval', 'integer', ':=', '300'),
  (1, 'Standard', 'Framed-Protocol', 'string', ':=', 'PPP'),
  (2, 'MikroTik', 'Mikrotik-Rate-Limit', 'string', ':=', '200M/200M'),
  (2, 'Standard', 'Acct-Interim-Interval', 'integer', ':=', '300'),
  (3, 'MikroTik', 'Mikrotik-Rate-Limit', 'string', ':=', '50M/50M'),
  (3, 'Standard', 'Acct-Interim-Interval', 'integer', ':=', '300'),
  (4, 'MikroTik', 'Mikrotik-Rate-Limit', 'string', ':=', '10M/10M'),
  (4, 'Standard', 'Acct-Interim-Interval', 'integer', ':=', '300')
ON CONFLICT DO NOTHING;

-- Link existing packages to their radius_profiles
UPDATE packages SET radius_profile_id = 1 WHERE name = 'Fiber 100 Mbps';
UPDATE packages SET radius_profile_id = 2 WHERE name = 'Fiber 200 Mbps';
UPDATE packages SET radius_profile_id = 3 WHERE name = 'Fiber 50 Mbps';
UPDATE packages SET radius_profile_id = 4 WHERE name = 'Test 10M';

-- Seed Standard IP Pools
INSERT INTO ip_pools (id, name, network, gateway, start_ip, end_ip, subnet, description, total_ips, used_ips) VALUES
  (1, 'FW-POOL-100', '100.111.0.0/16', '100.111.0.1', '100.111.20.10', '100.111.20.250', '255.255.0.0', 'Primary CGNAT dynamic pool for Kathmandu Core BNG', 241, 3),
  (2, 'FW-POOL-PUBLIC', '103.158.110.0/24', '103.158.110.1', '103.158.110.10', '103.158.110.200', '255.255.255.0', 'Public static routable IP pool for corporate subscribers', 191, 1)
ON CONFLICT (id) DO NOTHING;
SELECT setval('ip_pools_id_seq', (SELECT MAX(id) FROM ip_pools));

-- Seed sample allocated IPs
INSERT INTO ip_addresses (pool_id, ip_address, subscriber_id, status, allocation_date, last_seen, notes) VALUES
  (1, '100.111.20.21', 1, 'assigned', NOW() - INTERVAL '30 days', NOW(), 'Assigned to aakash001'),
  (1, '100.111.21.45', 2, 'assigned', NOW() - INTERVAL '15 days', NOW(), 'Assigned to user10021'),
  (1, '100.111.30.105', 3, 'assigned', NOW() - INTERVAL '40 days', NOW(), 'Assigned to sharma_sub'),
  (2, '100.111.99.10', 6, 'assigned', NOW() - INTERVAL '1 day', NOW(), 'Test Static IP')
ON CONFLICT (ip_address) DO NOTHING;

-- Seed initial subscriber_services records for existing subscribers
INSERT INTO subscriber_services (service_id, subscriber_id, package_id, start_date, expiry_date, status, nas_id, ip_address, created_by)
SELECT
  'SRV-' || s.customer_id,
  s.id,
  s.current_package_id,
  s.created_at,
  s.expiry_date,
  CASE
    WHEN s.status = 'suspended' THEN 'suspended'
    WHEN s.expiry_date < NOW() THEN 'expired'
    ELSE 'active'
  END,
  s.nas_restriction_id,
  s.static_ip,
  'admin'
FROM subscribers s
WHERE s.current_package_id IS NOT NULL
ON CONFLICT (service_id) DO NOTHING;

-- Seed initial activity timeline records
INSERT INTO subscriber_activity (subscriber_id, action, details, admin_username, created_at)
SELECT
  s.id,
  'subscriber_created',
  'Subscriber profile created with initial package assignment',
  'admin',
  s.created_at
FROM subscribers s
ON CONFLICT DO NOTHING;

-- Seed sample notes
INSERT INTO subscriber_notes (subscriber_id, author_name, content, created_at) VALUES
  (1, 'System Administrator', 'Customer verified by NOC team. Optical signal levels normal (-18 dBm on PON 1/2).', NOW() - INTERVAL '5 days'),
  (1, 'Support Desk', 'Customer requested static IP allocation for home lab server.', NOW() - INTERVAL '2 days'),
  (4, 'Billing Team', 'Service temporarily suspended pending invoice payment for current cycle.', NOW() - INTERVAL '1 day')
ON CONFLICT DO NOTHING;
