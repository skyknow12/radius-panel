-- =============================================================================
-- Migration 018: OLT Management, Huawei MA5683T Integration & ONU Provisioning
-- =============================================================================

-- 1. OLT Inventory Table
CREATE TABLE IF NOT EXISTS olts (
  id                          SERIAL PRIMARY KEY,
  name                        VARCHAR(128) NOT NULL,
  vendor                      VARCHAR(64) NOT NULL DEFAULT 'Huawei',
  model                       VARCHAR(64) NOT NULL DEFAULT 'MA5683T',
  hardware_version            VARCHAR(64) DEFAULT 'MA5683T',
  software_version            VARCHAR(64) DEFAULT 'MA5600V800R015C00',
  patch_version               VARCHAR(64) DEFAULT 'SPC108 HP1019',
  management_ip               INET NOT NULL,
  management_port             INTEGER NOT NULL DEFAULT 23,
  branch_id                   INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  organization_id             INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  snmp_version                VARCHAR(16) NOT NULL DEFAULT 'v2c',
  snmp_port                   INTEGER NOT NULL DEFAULT 161,
  snmp_community_encrypted    TEXT,
  snmp_v3_config              JSONB DEFAULT '{}'::jsonb,
  cli_protocol                VARCHAR(16) NOT NULL DEFAULT 'telnet' CHECK (cli_protocol IN ('telnet', 'ssh')),
  cli_username                VARCHAR(64) NOT NULL DEFAULT 'root',
  cli_password_encrypted      TEXT NOT NULL,
  connection_timeout          INTEGER NOT NULL DEFAULT 5000,
  polling_interval            INTEGER NOT NULL DEFAULT 300,
  enabled                     BOOLEAN NOT NULL DEFAULT TRUE,
  connection_status           VARCHAR(24) NOT NULL DEFAULT 'unknown' CHECK (connection_status IN ('online', 'offline', 'error', 'unknown')),
  last_seen_at                TIMESTAMPTZ,
  last_sync_at                TIMESTAMPTZ,
  last_error                  TEXT,
  optical_warning_threshold   NUMERIC(5,2) NOT NULL DEFAULT -25.00,
  optical_critical_threshold  NUMERIC(5,2) NOT NULL DEFAULT -28.00,
  created_by                  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS olts_branch_idx ON olts (branch_id);
CREATE INDEX IF NOT EXISTS olts_org_idx ON olts (organization_id);
CREATE INDEX IF NOT EXISTS olts_status_idx ON olts (connection_status);

DROP TRIGGER IF EXISTS olts_updated_at ON olts;
CREATE TRIGGER olts_updated_at BEFORE UPDATE ON olts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. Registered & Discovered ONUs Table
CREATE TABLE IF NOT EXISTS onus (
  id                          SERIAL PRIMARY KEY,
  olt_id                      INTEGER NOT NULL REFERENCES olts(id) ON DELETE CASCADE,
  serial_number               VARCHAR(64) NOT NULL,
  frame                       INTEGER NOT NULL DEFAULT 0,
  slot                        INTEGER NOT NULL,
  pon_port                    INTEGER NOT NULL,
  ont_id                      INTEGER NOT NULL,
  description                 VARCHAR(128),
  vendor_id                   VARCHAR(32),
  equipment_id                VARCHAR(64),
  model                       VARCHAR(64),
  mac_address                 VARCHAR(32),
  control_flag                VARCHAR(32) DEFAULT 'active',
  run_state                   VARCHAR(24) NOT NULL DEFAULT 'offline' CHECK (run_state IN ('online', 'offline', 'missing', 'unknown')),
  config_state                VARCHAR(24) NOT NULL DEFAULT 'initial' CHECK (config_state IN ('initial', 'normal', 'failed', 'unknown')),
  match_state                 VARCHAR(24) NOT NULL DEFAULT 'match' CHECK (match_state IN ('match', 'mismatch', 'unknown')),
  protection_state            VARCHAR(24) DEFAULT 'unprotected',
  auth_type                   VARCHAR(24) DEFAULT 'SN-auth',
  management_mode             VARCHAR(24) DEFAULT 'omci',
  line_profile_id             INTEGER,
  line_profile_name           VARCHAR(64),
  service_profile_id          INTEGER,
  service_profile_name        VARCHAR(64),
  last_up_time                TIMESTAMPTZ,
  last_down_time              TIMESTAMPTZ,
  last_down_cause             VARCHAR(128),
  registration_state          VARCHAR(24) NOT NULL DEFAULT 'registered' CHECK (registration_state IN ('registered', 'unregistered', 'missing')),
  last_rx_power               NUMERIC(5,2),
  last_tx_power               NUMERIC(5,2),
  last_olt_rx_power           NUMERIC(5,2),
  last_optical_reading_at     TIMESTAMPTZ,
  last_seen_at                TIMESTAMPTZ,
  last_sync_at                TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_olt_serial_number UNIQUE (olt_id, serial_number)
);

CREATE INDEX IF NOT EXISTS onus_olt_idx ON onus (olt_id);
CREATE INDEX IF NOT EXISTS onus_sn_idx ON onus (serial_number);
CREATE INDEX IF NOT EXISTS onus_f_s_p_idx ON onus (olt_id, frame, slot, pon_port, ont_id);
CREATE INDEX IF NOT EXISTS onus_run_state_idx ON onus (run_state);

DROP TRIGGER IF EXISTS onus_updated_at ON onus;
CREATE TRIGGER onus_updated_at BEFORE UPDATE ON onus
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Customer to ONU Association
CREATE TABLE IF NOT EXISTS customer_onu_associations (
  id                          SERIAL PRIMARY KEY,
  customer_id                 INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  onu_id                      INTEGER NOT NULL REFERENCES onus(id) ON DELETE CASCADE,
  olt_id                      INTEGER NOT NULL REFERENCES olts(id) ON DELETE CASCADE,
  association_source          VARCHAR(32) NOT NULL DEFAULT 'manual' CHECK (association_source IN ('manual', 'sn_match', 'description_match', 'mac_match')),
  associated_by               UUID REFERENCES users(id) ON DELETE SET NULL,
  associated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes                       TEXT,
  CONSTRAINT uq_customer_onu UNIQUE (customer_id)
);

CREATE INDEX IF NOT EXISTS cust_onu_cust_idx ON customer_onu_associations (customer_id);
CREATE INDEX IF NOT EXISTS cust_onu_onu_idx ON customer_onu_associations (onu_id);
CREATE INDEX IF NOT EXISTS cust_onu_olt_idx ON customer_onu_associations (olt_id);

-- 4. Optical Monitoring Reading History
CREATE TABLE IF NOT EXISTS onu_optical_history (
  id                          BIGSERIAL PRIMARY KEY,
  olt_id                      INTEGER NOT NULL REFERENCES olts(id) ON DELETE CASCADE,
  onu_id                      INTEGER REFERENCES onus(id) ON DELETE CASCADE,
  serial_number               VARCHAR(64) NOT NULL,
  frame                       INTEGER NOT NULL DEFAULT 0,
  slot                        INTEGER NOT NULL,
  pon_port                    INTEGER NOT NULL,
  ont_id                      INTEGER NOT NULL,
  rx_power                    NUMERIC(5,2),
  tx_power                    NUMERIC(5,2),
  olt_rx_power                NUMERIC(5,2),
  temperature                 NUMERIC(5,2),
  voltage                     NUMERIC(5,2),
  bias_current                NUMERIC(5,2),
  source                      VARCHAR(16) NOT NULL DEFAULT 'cli' CHECK (source IN ('cli', 'snmp')),
  collection_status           VARCHAR(16) NOT NULL DEFAULT 'success' CHECK (collection_status IN ('success', 'failed')),
  error_message               TEXT,
  collected_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS onu_optical_sn_idx ON onu_optical_history (serial_number, collected_at DESC);
CREATE INDEX IF NOT EXISTS onu_optical_onu_idx ON onu_optical_history (onu_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS onu_optical_olt_idx ON onu_optical_history (olt_id, collected_at DESC);

-- 5. OLT Operation History / Audit
CREATE TABLE IF NOT EXISTS olt_operation_history (
  id                          BIGSERIAL PRIMARY KEY,
  olt_id                      INTEGER NOT NULL REFERENCES olts(id) ON DELETE CASCADE,
  operation_type              VARCHAR(64) NOT NULL,
  operator_id                 UUID REFERENCES users(id) ON DELETE SET NULL,
  operator_username           VARCHAR(64),
  sanitized_command_summary   TEXT NOT NULL,
  status                      VARCHAR(24) NOT NULL CHECK (status IN ('started', 'success', 'partial_success', 'failed')),
  sanitized_result            TEXT,
  started_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at                TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS olt_op_history_olt_idx ON olt_operation_history (olt_id, started_at DESC);

-- 6. OLT Profiles Catalog
CREATE TABLE IF NOT EXISTS olt_profiles (
  id                          SERIAL PRIMARY KEY,
  olt_id                      INTEGER NOT NULL REFERENCES olts(id) ON DELETE CASCADE,
  profile_type                VARCHAR(32) NOT NULL CHECK (profile_type IN ('line', 'service')),
  profile_id                  INTEGER NOT NULL,
  profile_name                VARCHAR(64) NOT NULL,
  source                      VARCHAR(16) NOT NULL DEFAULT 'local' CHECK (source IN ('olt', 'local')),
  is_verified                 BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at                 TIMESTAMPTZ,
  details                     JSONB DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_olt_profile UNIQUE (olt_id, profile_type, profile_id)
);

CREATE INDEX IF NOT EXISTS olt_profiles_olt_idx ON olt_profiles (olt_id, profile_type);

DROP TRIGGER IF EXISTS olt_profiles_updated_at ON olt_profiles;
CREATE TRIGGER olt_profiles_updated_at BEFORE UPDATE ON olt_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 7. OLT Service Ports Table
CREATE TABLE IF NOT EXISTS olt_service_ports (
  id                          SERIAL PRIMARY KEY,
  olt_id                      INTEGER NOT NULL REFERENCES olts(id) ON DELETE CASCADE,
  service_port_id             INTEGER,
  vlan_id                     INTEGER NOT NULL,
  user_vlan_id                INTEGER NOT NULL,
  frame                       INTEGER NOT NULL DEFAULT 0,
  slot                        INTEGER NOT NULL,
  pon_port                    INTEGER NOT NULL,
  ont_id                      INTEGER NOT NULL,
  gemport                     INTEGER NOT NULL DEFAULT 10,
  tag_transform               VARCHAR(32) NOT NULL DEFAULT 'translate',
  status                      VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS olt_sp_olt_ont_idx ON olt_service_ports (olt_id, frame, slot, pon_port, ont_id);

-- 8. Seed OLT Permissions
INSERT INTO permissions (key, module, description) VALUES
  ('olt.view',            'olt', 'View OLT inventory, status, and boards'),
  ('olt.create',          'olt', 'Register new OLT devices'),
  ('olt.edit',            'olt', 'Modify OLT device configurations and credentials'),
  ('olt.delete',          'olt', 'Remove OLT devices from inventory'),
  ('olt.test_connection', 'olt', 'Execute CLI and SNMP connectivity tests to OLT'),
  ('olt.discover',        'olt', 'Run unregistered ONU discovery on OLT PON ports'),
  ('olt.sync',            'olt', 'Synchronize live ONU inventory with OLT hardware'),
  ('olt.view_optical',    'olt', 'Read and view ONU optical power and diagnostics'),
  ('olt.register_onu',    'olt', 'Provision and register ONUs and service ports'),
  ('olt.delete_onu',      'olt', 'Unregister and delete ONUs from OLT'),
  ('olt.manage_profiles', 'olt', 'Manage line and service profile catalogs'),
  ('olt.view_history',    'olt', 'View OLT operations, execution logs, and audit trail')
ON CONFLICT (key) DO UPDATE SET
  module = EXCLUDED.module,
  description = EXCLUDED.description;

-- 9. Assign OLT Permissions to System Roles
-- Super Admin (Developer) gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin' AND p.module = 'olt'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ISP Admin gets full operational OLT control
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'isp_admin' AND p.module = 'olt'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Branch Manager gets operational ONU and OLT visibility for their branch
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'branch_manager'
  AND p.key IN (
    'olt.view',
    'olt.view_optical',
    'olt.discover',
    'olt.register_onu',
    'olt.sync',
    'olt.view_history'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- NOC Head gets all operational OLT permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'noc_head' AND p.module = 'olt'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- NOC Operator gets monitoring, discovery, optical and testing
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'noc_operator'
  AND p.key IN (
    'olt.view',
    'olt.test_connection',
    'olt.discover',
    'olt.sync',
    'olt.view_optical',
    'olt.view_history'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Support Operator gets read and optical inspection
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'support_operator'
  AND p.key IN (
    'olt.view',
    'olt.view_optical',
    'olt.view_history'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Read Only gets view and optical inspection
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'read_only'
  AND p.key IN ('olt.view', 'olt.view_optical')
ON CONFLICT (role_id, permission_id) DO NOTHING;
