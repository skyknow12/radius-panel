-- =============================================================================
-- Migration 023: ONU Web Management, Model Profiles & Reusable Credentials
-- =============================================================================

-- 1. Extend onus table with Web Management state and network addressing
ALTER TABLE onus
  ADD COLUMN IF NOT EXISTS management_ip             INET,
  ADD COLUMN IF NOT EXISTS web_port                  INTEGER NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS web_protocol              VARCHAR(8) NOT NULL DEFAULT 'http' CHECK (web_protocol IN ('http', 'https')),
  ADD COLUMN IF NOT EXISTS firmware_version          VARCHAR(128),
  ADD COLUMN IF NOT EXISTS hardware_version          VARCHAR(128),
  ADD COLUMN IF NOT EXISTS web_status                VARCHAR(24) NOT NULL DEFAULT 'unknown' CHECK (web_status IN ('reachable', 'unreachable', 'unknown')),
  ADD COLUMN IF NOT EXISTS management_status         VARCHAR(24) NOT NULL DEFAULT 'unconfigured' CHECK (management_status IN ('unconfigured', 'pending_profile', 'configured', 'unsupported', 'error')),
  ADD COLUMN IF NOT EXISTS profile_id                INTEGER,
  ADD COLUMN IF NOT EXISTS last_web_seen_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_wifi_configured_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wifi_ssid_2g              VARCHAR(64),
  ADD COLUMN IF NOT EXISTS wifi_ssid_5g              VARCHAR(64),
  ADD COLUMN IF NOT EXISTS wifi_last_status          VARCHAR(24) NOT NULL DEFAULT 'unknown' CHECK (wifi_last_status IN ('verified', 'unverified', 'failed', 'unknown'));

CREATE INDEX IF NOT EXISTS idx_onus_management_status ON onus (management_status);
CREATE INDEX IF NOT EXISTS idx_onus_web_status ON onus (web_status);
CREATE INDEX IF NOT EXISTS idx_onus_management_ip ON onus (management_ip);

-- 2. Reusable ONU Model Profiles
CREATE TABLE IF NOT EXISTS onu_model_profiles (
  id                          SERIAL PRIMARY KEY,
  name                        VARCHAR(128) NOT NULL,
  vendor                      VARCHAR(64) NOT NULL,
  model                       VARCHAR(64) NOT NULL,
  firmware_pattern            VARCHAR(128) NOT NULL DEFAULT '',
  adapter_type                VARCHAR(32) NOT NULL DEFAULT 'generic_web' CHECK (adapter_type IN ('huawei_web', 'zte_web', 'generic_web', 'unsupported')),
  default_protocol            VARCHAR(16) NOT NULL DEFAULT 'http' CHECK (default_protocol IN ('http', 'https')),
  default_port                INTEGER NOT NULL DEFAULT 80,
  login_path                  VARCHAR(128) NOT NULL DEFAULT '/',
  default_username            VARCHAR(64) NOT NULL DEFAULT 'telecomadmin',
  default_password_encrypted  TEXT,
  wifi_bands                  VARCHAR(32)[] NOT NULL DEFAULT '{"2.4GHz", "5GHz"}'::varchar[],
  capabilities                JSONB NOT NULL DEFAULT '{"change_ssid": true, "change_password": true, "read_wifi": true, "verify_changes": true}'::jsonb,
  status                      VARCHAR(24) NOT NULL DEFAULT 'needs_testing' CHECK (status IN ('active', 'disabled', 'needs_testing')),
  tested_capabilities         JSONB NOT NULL DEFAULT '{"connection": false, "auth": false, "info": false, "ssid": false, "password": false, "verify": false}'::jsonb,
  notes                       TEXT,
  created_by                  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_onu_model_profile UNIQUE (vendor, model, firmware_pattern)
);

CREATE INDEX IF NOT EXISTS idx_onu_profiles_vm ON onu_model_profiles (vendor, model);
CREATE INDEX IF NOT EXISTS idx_onu_profiles_status ON onu_model_profiles (status);

DROP TRIGGER IF EXISTS onu_model_profiles_updated_at ON onu_model_profiles;
CREATE TRIGGER onu_model_profiles_updated_at BEFORE UPDATE ON onu_model_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Add foreign key constraint to onus.profile_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_onus_profile_id' AND table_name = 'onus'
  ) THEN
    ALTER TABLE onus
      ADD CONSTRAINT fk_onus_profile_id
      FOREIGN KEY (profile_id) REFERENCES onu_model_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. ONU Management Credential Profiles (Scoped hierarchy: device > branch > model > global)
CREATE TABLE IF NOT EXISTS onu_credential_profiles (
  id                          SERIAL PRIMARY KEY,
  name                        VARCHAR(128) NOT NULL,
  scope                       VARCHAR(24) NOT NULL CHECK (scope IN ('global', 'model', 'branch', 'device')),
  profile_id                  INTEGER REFERENCES onu_model_profiles(id) ON DELETE CASCADE,
  branch_id                   INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  onu_id                      INTEGER REFERENCES onus(id) ON DELETE CASCADE,
  username                    VARCHAR(64) NOT NULL,
  password_encrypted          TEXT NOT NULL,
  notes                       TEXT,
  created_by                  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onu_creds_scope ON onu_credential_profiles (scope);
CREATE INDEX IF NOT EXISTS idx_onu_creds_profile ON onu_credential_profiles (profile_id);
CREATE INDEX IF NOT EXISTS idx_onu_creds_branch ON onu_credential_profiles (branch_id);
CREATE INDEX IF NOT EXISTS idx_onu_creds_onu ON onu_credential_profiles (onu_id);

DROP TRIGGER IF EXISTS onu_credential_profiles_updated_at ON onu_credential_profiles;
CREATE TRIGGER onu_credential_profiles_updated_at BEFORE UPDATE ON onu_credential_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. New Model Requests / Pending Configuration Workflow
CREATE TABLE IF NOT EXISTS onu_model_requests (
  id                          SERIAL PRIMARY KEY,
  vendor                      VARCHAR(64) NOT NULL,
  model                       VARCHAR(64) NOT NULL,
  firmware                    VARCHAR(128) NOT NULL DEFAULT '',
  detected_on_olt_id          INTEGER REFERENCES olts(id) ON DELETE CASCADE,
  detected_on_branch_id       INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  sample_onu_id               INTEGER REFERENCES onus(id) ON DELETE SET NULL,
  sample_serial_number        VARCHAR(64),
  sample_management_ip        INET,
  web_status                  VARCHAR(24) NOT NULL DEFAULT 'unknown' CHECK (web_status IN ('reachable', 'unreachable', 'unknown')),
  device_count                INTEGER NOT NULL DEFAULT 1,
  status                      VARCHAR(24) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'ignored')),
  resolved_profile_id         INTEGER REFERENCES onu_model_profiles(id) ON DELETE SET NULL,
  first_detected_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_detected_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_onu_model_request UNIQUE (vendor, model, firmware)
);

CREATE INDEX IF NOT EXISTS idx_onu_requests_status ON onu_model_requests (status);
CREATE INDEX IF NOT EXISTS idx_onu_requests_vendor ON onu_model_requests (vendor, model);

DROP TRIGGER IF EXISTS onu_model_requests_updated_at ON onu_model_requests;
CREATE TRIGGER onu_model_requests_updated_at BEFORE UPDATE ON onu_model_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. Management Activity Logs & Audit Trail
CREATE TABLE IF NOT EXISTS onu_management_activity_logs (
  id                          BIGSERIAL PRIMARY KEY,
  onu_id                      INTEGER REFERENCES onus(id) ON DELETE SET NULL,
  customer_id                 INTEGER REFERENCES subscribers(id) ON DELETE SET NULL,
  branch_id                   INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  operator_id                 UUID REFERENCES users(id) ON DELETE SET NULL,
  operator_username           VARCHAR(64),
  operation_type              VARCHAR(48) NOT NULL CHECK (
    operation_type IN (
      'test_connection',
      'test_login',
      'read_info',
      'read_wifi',
      'change_ssid',
      'change_password',
      'change_both',
      'profile_test',
      'detect_model'
    )
  ),
  vendor                      VARCHAR(64),
  model                       VARCHAR(64),
  target_ip                   INET,
  status                      VARCHAR(24) NOT NULL CHECK (status IN ('started', 'success', 'failed', 'unsupported', 'unverified')),
  verification_status         VARCHAR(24) NOT NULL DEFAULT 'not_applicable' CHECK (verification_status IN ('verified', 'unverified', 'failed', 'not_applicable')),
  sanitized_details           JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message               TEXT,
  duration_ms                 INTEGER,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onu_logs_onu ON onu_management_activity_logs (onu_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_onu_logs_cust ON onu_management_activity_logs (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_onu_logs_branch ON onu_management_activity_logs (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_onu_logs_status ON onu_management_activity_logs (status);

-- 6. Seed ONU Web Management Permissions
INSERT INTO permissions (key, module, description) VALUES
  ('onu.view',               'onu', 'View ONU management inventory, status, and detected models'),
  ('onu.manage_profiles',    'onu', 'Create, edit, and test reusable ONU model profiles'),
  ('onu.manage_credentials', 'onu', 'Configure scoped ONU credentials at model, branch, or device levels'),
  ('onu.test_connection',    'onu', 'Execute live login and connectivity probes against ONUs'),
  ('onu.configure_wifi',     'onu', 'Change subscriber Wi-Fi SSID and security passphrases'),
  ('onu.view_logs',          'onu', 'Inspect ONU management audit trail and operational logs')
ON CONFLICT (key) DO UPDATE SET
  module = EXCLUDED.module,
  description = EXCLUDED.description;

-- Assign permissions to Super Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin' AND p.module = 'onu'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to ISP Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'isp_admin' AND p.module = 'onu'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Branch Manager (View, Test, Wi-Fi configuration within branch)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'branch_manager'
  AND p.key IN (
    'onu.view',
    'onu.test_connection',
    'onu.configure_wifi',
    'onu.view_logs'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to NOC Head
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'noc_head' AND p.module = 'onu'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 7. Seed Known Model Profiles (in needs_testing status until verified on physical hardware)
INSERT INTO onu_model_profiles (
  name, vendor, model, firmware_pattern, adapter_type, default_protocol, default_port,
  login_path, default_username, wifi_bands, capabilities, status, notes
) VALUES
  (
    'Huawei HG8145V5 Dual-Band Gateway',
    'Huawei',
    'HG8145V5',
    '',
    'huawei_web',
    'http',
    80,
    '/',
    'telecomadmin',
    '{"2.4GHz", "5GHz"}'::varchar[],
    '{"change_ssid": true, "change_password": true, "read_wifi": true, "verify_changes": true}'::jsonb,
    'needs_testing',
    'Huawei SmartAX EchoLife GPON Terminal with Dual-Band AC Wi-Fi'
  ),
  (
    'Huawei EG8145V5 Routing Gateway',
    'Huawei',
    'EG8145V5',
    '',
    'huawei_web',
    'http',
    80,
    '/',
    'telecomadmin',
    '{"2.4GHz", "5GHz"}'::varchar[],
    '{"change_ssid": true, "change_password": true, "read_wifi": true, "verify_changes": true}'::jsonb,
    'needs_testing',
    'Huawei Enterprise GPON Optical Network Terminal with GE + Wi-Fi'
  ),
  (
    'ZTE F670L Dual-Band GPON ONT',
    'ZTE',
    'F670L',
    '',
    'zte_web',
    'http',
    80,
    '/',
    'admin',
    '{"2.4GHz", "5GHz"}'::varchar[],
    '{"change_ssid": true, "change_password": true, "read_wifi": true, "verify_changes": true}'::jsonb,
    'needs_testing',
    'ZTE ZXHN F670L Gigabit AC1200 Dual-Band GPON Gateway'
  )
ON CONFLICT (vendor, model, firmware_pattern) DO NOTHING;
