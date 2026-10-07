-- =============================================================================
--  RADIUS PRO — Migration 003: Real ISP RADIUS Operations (Phase 2)
--
--  Entities:
--    packages, package_attributes, subscribers, subscriber_packages
--  Updates to nas_devices (secret column, synchronization support)
--  Performance indexes for ISP-scale radacct and radpostauth
-- =============================================================================

-- 1. Extend nas_devices with secret and sync tracking
ALTER TABLE nas_devices
  ADD COLUMN IF NOT EXISTS secret TEXT NOT NULL DEFAULT 'testing123',
  ADD COLUMN IF NOT EXISTS ports INTEGER DEFAULT 1812,
  ADD COLUMN IF NOT EXISTS community VARCHAR(64) DEFAULT 'public';

-- Ensure unique shortname in FreeRADIUS nas table
CREATE UNIQUE INDEX IF NOT EXISTS nas_shortname_idx ON nas (shortname);

-- 2. Service Packages Table
CREATE TABLE IF NOT EXISTS packages (
  id                   SERIAL PRIMARY KEY,
  name                 VARCHAR(64) NOT NULL UNIQUE,
  download_speed_mbps  INTEGER NOT NULL CHECK (download_speed_mbps > 0),
  upload_speed_mbps    INTEGER NOT NULL CHECK (upload_speed_mbps > 0),
  rate_limit           VARCHAR(64) NOT NULL, -- e.g. "100M/100M"
  validity_days        INTEGER NOT NULL DEFAULT 30 CHECK (validity_days > 0),
  price                NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
  currency             VARCHAR(8) NOT NULL DEFAULT 'NPR',
  description          TEXT,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS packages_updated_at ON packages;
CREATE TRIGGER packages_updated_at BEFORE UPDATE ON packages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Package RADIUS Attributes Table (Flexible MikroTik & RFC attribute system)
CREATE TABLE IF NOT EXISTS package_attributes (
  id          SERIAL PRIMARY KEY,
  package_id  INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  attribute   VARCHAR(64) NOT NULL,
  op          VARCHAR(2) NOT NULL DEFAULT ':=',
  value       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS package_attributes_package_id_idx ON package_attributes(package_id);

-- 4. Subscribers Table (ISP End-Users / PPPoE / IPoE / Hotspot clients)
CREATE TABLE IF NOT EXISTS subscribers (
  id                   SERIAL PRIMARY KEY,
  customer_id          VARCHAR(32) NOT NULL UNIQUE,
  username             VARCHAR(64) NOT NULL UNIQUE,
  password_cleartext   TEXT NOT NULL,
  full_name            VARCHAR(128) NOT NULL,
  email                VARCHAR(255),
  phone                VARCHAR(32),
  status               VARCHAR(16) NOT NULL DEFAULT 'enabled'
                       CHECK (status IN ('enabled', 'disabled', 'suspended')),
  current_package_id   INTEGER REFERENCES packages(id) ON DELETE SET NULL,
  static_ip            INET,
  mac_address          VARCHAR(32),
  vlan_id              INTEGER,
  nas_restriction_id   INTEGER REFERENCES nas_devices(id) ON DELETE SET NULL,
  expiry_date          TIMESTAMPTZ,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscribers_username_idx ON subscribers (lower(username));
CREATE INDEX IF NOT EXISTS subscribers_customer_id_idx ON subscribers (lower(customer_id));
CREATE INDEX IF NOT EXISTS subscribers_status_idx ON subscribers (status);
CREATE INDEX IF NOT EXISTS subscribers_package_idx ON subscribers (current_package_id);
CREATE INDEX IF NOT EXISTS subscribers_expiry_idx ON subscribers (expiry_date);

DROP TRIGGER IF EXISTS subscribers_updated_at ON subscribers;
CREATE TRIGGER subscribers_updated_at BEFORE UPDATE ON subscribers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. Subscriber Package History
CREATE TABLE IF NOT EXISTS subscriber_packages (
  id             SERIAL PRIMARY KEY,
  subscriber_id  INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  package_id     INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  start_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date       TIMESTAMPTZ,
  price          NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscriber_packages_sub_idx ON subscriber_packages (subscriber_id);

-- 6. Additional Performance Indexes for High-Traffic ISP Accounting & Post-Auth
CREATE INDEX IF NOT EXISTS radacct_username_lower_idx ON radacct (lower(UserName));
CREATE INDEX IF NOT EXISTS radacct_nasip_active_idx ON radacct (NASIPAddress) WHERE AcctStopTime IS NULL;
CREATE INDEX IF NOT EXISTS radacct_framed_ip_active_idx ON radacct (FramedIPAddress) WHERE AcctStopTime IS NULL;
CREATE INDEX IF NOT EXISTS radpostauth_reply_idx ON radpostauth (reply);
CREATE INDEX IF NOT EXISTS radpostauth_username_date_idx ON radpostauth (lower(username), authdate DESC);

-- 7. Additional Phase 2 Permissions
INSERT INTO permissions (key, module, description) VALUES
  ('subscribers.view',       'subscribers', 'View subscribers list and details'),
  ('subscribers.create',     'subscribers', 'Create new subscribers'),
  ('subscribers.edit',       'subscribers', 'Edit existing subscribers'),
  ('subscribers.suspend',    'subscribers', 'Suspend or resume subscribers'),
  ('subscribers.delete',     'subscribers', 'Delete subscribers'),
  ('subscribers.disconnect', 'subscribers', 'Disconnect active subscriber sessions')
ON CONFLICT (key) DO NOTHING;

-- Grant to super_admin and admin
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
  WHERE r.name IN ('super_admin', 'admin')
  AND p.key LIKE 'subscribers.%'
ON CONFLICT DO NOTHING;

-- Grant read and suspend permissions to operator
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r JOIN permissions p ON p.key IN (
    'subscribers.view', 'subscribers.suspend', 'subscribers.disconnect'
  )
  WHERE r.name = 'operator'
ON CONFLICT DO NOTHING;

-- 8. Seed Default ISP Service Packages
INSERT INTO packages (name, download_speed_mbps, upload_speed_mbps, rate_limit, validity_days, price, currency, description) VALUES
  ('Fiber 100 Mbps', 100, 100, '100M/100M', 30, 2000.00, 'NPR', 'High-speed symmetrical FTTH internet for households'),
  ('Fiber 50 Mbps',   50,  50, '50M/50M',   30, 1400.00, 'NPR', 'Standard broadband plan for everyday streaming and surfing'),
  ('Fiber 200 Mbps', 200, 200, '200M/200M', 30, 3200.00, 'NPR', 'Ultra-fast gigabit-ready plan for gamers and power users'),
  ('Test 10M',        10,  10, '10M/10M',   30,  500.00, 'NPR', 'Quality assurance diagnostic and verification plan')
ON CONFLICT (name) DO NOTHING;

-- 9. Seed Package Attributes in radgroupreply
-- For each package, insert default MikroTik-Rate-Limit and Acct-Interim-Interval
INSERT INTO radgroupreply (GroupName, Attribute, op, Value)
SELECT name, 'Mikrotik-Rate-Limit', ':=', rate_limit FROM packages
ON CONFLICT DO NOTHING;

INSERT INTO radgroupreply (GroupName, Attribute, op, Value)
SELECT name, 'Acct-Interim-Interval', ':=', '300' FROM packages
ON CONFLICT DO NOTHING;

INSERT INTO radgroupreply (GroupName, Attribute, op, Value)
SELECT name, 'Framed-Protocol', ':=', 'PPP' FROM packages
ON CONFLICT DO NOTHING;

INSERT INTO radgroupreply (GroupName, Attribute, op, Value)
SELECT name, 'Service-Type', ':=', 'Framed-User' FROM packages
ON CONFLICT DO NOTHING;

-- Sync package_attributes table
INSERT INTO package_attributes (package_id, attribute, op, value)
SELECT id, 'Mikrotik-Rate-Limit', ':=', rate_limit FROM packages
ON CONFLICT DO NOTHING;

INSERT INTO package_attributes (package_id, attribute, op, value)
SELECT id, 'Acct-Interim-Interval', ':=', '300' FROM packages
ON CONFLICT DO NOTHING;

-- 10. Seed Demo Subscribers
INSERT INTO subscribers (
  customer_id, username, password_cleartext, full_name, email, phone, status,
  current_package_id, static_ip, mac_address, expiry_date, notes
) VALUES
  ('FW100001', 'aakash001', 'Nepal@2026', 'Aakash Thapa', 'aakash@example.com', '9801234567', 'enabled',
   (SELECT id FROM packages WHERE name = 'Fiber 100 Mbps'), '100.111.20.21', 'A4:83:E7:22:90:1A',
   NOW() + INTERVAL '30 days', 'Core FTTH customer in Kathmandu'),
  ('FW100002', 'user10021', 'Secret123', 'Sunita Sharma', 'sunita@example.com', '9841234568', 'enabled',
   (SELECT id FROM packages WHERE name = 'Fiber 50 Mbps'), '100.111.21.45', 'D8:5E:D3:44:11:8B',
   NOW() + INTERVAL '14 days', 'Residential PPPoE connection'),
  ('FW100003', 'sharma_sub', 'SubPass456', 'Bikash Sharma', 'bikash@example.com', '9851234569', 'enabled',
   (SELECT id FROM packages WHERE name = 'Fiber 200 Mbps'), '100.111.30.105', 'F0:9F:C2:10:E4:55',
   NOW() + INTERVAL '45 days', 'Enterprise small-office plan'),
  ('FW100004', 'suspended_user', 'Suspend123', 'Ramesh Adhikari', 'ramesh@example.com', '9811234570', 'suspended',
   (SELECT id FROM packages WHERE name = 'Fiber 50 Mbps'), NULL, NULL,
   NOW() + INTERVAL '5 days', 'Temporarily suspended by NOC for non-payment'),
  ('FW100005', 'expired_user', 'Expired123', 'Pooja Karki', 'pooja@example.com', '9861234571', 'enabled',
   (SELECT id FROM packages WHERE name = 'Fiber 100 Mbps'), NULL, NULL,
   NOW() - INTERVAL '3 days', 'Service expired on 3 days ago'),
  ('FW-TEST', 'radius-test', 'ChangeMe123!', 'RADIUS Test Subscriber', 'test@skyradius.isp', '9800000000', 'enabled',
   (SELECT id FROM packages WHERE name = 'Test 10M'), '100.111.99.10', NULL,
   NOW() + INTERVAL '365 days', 'Requirement 28 Automated Verification User')
ON CONFLICT (username) DO NOTHING;

-- 11. Sync Subscribers into FreeRADIUS SQL (radcheck, radreply, radusergroup)
-- Cleartext-Password in radcheck for active users
INSERT INTO radcheck (UserName, Attribute, op, Value)
VALUES
  ('aakash001', 'Cleartext-Password', ':=', 'Nepal@2026'),
  ('user10021', 'Cleartext-Password', ':=', 'Secret123'),
  ('sharma_sub', 'Cleartext-Password', ':=', 'SubPass456'),
  ('radius-test', 'Cleartext-Password', ':=', 'ChangeMe123!'),
  ('expired_user', 'Cleartext-Password', ':=', 'Expired123'),
  ('suspended_user', 'Cleartext-Password', ':=', 'Suspend123')
ON CONFLICT DO NOTHING;

-- Reject suspended user
INSERT INTO radcheck (UserName, Attribute, op, Value)
VALUES
  ('suspended_user', 'Auth-Type', ':=', 'Reject')
ON CONFLICT DO NOTHING;

-- Set Expiration for expired_user and active users
-- Format: "01 Jan 2026 00:00:00"
INSERT INTO radcheck (UserName, Attribute, op, Value)
VALUES
  ('expired_user', 'Expiration', ':=', to_char(NOW() - INTERVAL '3 days', 'DD Mon YYYY HH24:MI:SS')),
  ('radius-test', 'Expiration', ':=', to_char(NOW() + INTERVAL '365 days', 'DD Mon YYYY HH24:MI:SS')),
  ('aakash001', 'Expiration', ':=', to_char(NOW() + INTERVAL '30 days', 'DD Mon YYYY HH24:MI:SS'))
ON CONFLICT DO NOTHING;

-- Framed-IP-Address in radreply for static IPs
INSERT INTO radreply (UserName, Attribute, op, Value)
VALUES
  ('aakash001', 'Framed-IP-Address', '=', '100.111.20.21'),
  ('radius-test', 'Framed-IP-Address', '=', '100.111.99.10')
ON CONFLICT DO NOTHING;

-- Map subscribers to package groups in radusergroup
INSERT INTO radusergroup (UserName, GroupName, priority)
VALUES
  ('aakash001', 'Fiber 100 Mbps', 1),
  ('user10021', 'Fiber 50 Mbps', 1),
  ('sharma_sub', 'Fiber 200 Mbps', 1),
  ('suspended_user', 'Fiber 50 Mbps', 1),
  ('expired_user', 'Fiber 100 Mbps', 1),
  ('radius-test', 'Test 10M', 1)
ON CONFLICT DO NOTHING;
