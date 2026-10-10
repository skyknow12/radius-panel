-- =============================================================================
-- Migration 016: Customer MAC Binding and Grace Period Management
-- =============================================================================

-- 1. Extend subscribers table with MAC binding and Grace Period fields
ALTER TABLE subscribers
  ADD COLUMN IF NOT EXISTS mac_binding_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mac_bound_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mac_bound_by VARCHAR(64),
  ADD COLUMN IF NOT EXISTS grace_period_override_days INTEGER NULL CHECK (grace_period_override_days >= 0 AND grace_period_override_days <= 30),
  ADD COLUMN IF NOT EXISTS grace_status VARCHAR(16) NOT NULL DEFAULT 'none' CHECK (grace_status IN ('none', 'active', 'expired')),
  ADD COLUMN IF NOT EXISTS grace_days_granted INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grace_start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grace_end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grace_granted_by VARCHAR(64),
  ADD COLUMN IF NOT EXISTS grace_granted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grace_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_sub_mac_binding ON subscribers (mac_binding_enabled);
CREATE INDEX IF NOT EXISTS idx_sub_grace_status ON subscribers (grace_status);
CREATE INDEX IF NOT EXISTS idx_sub_grace_end ON subscribers (grace_end_date);

-- 2. Extend organizations, branches, and resellers with configurable grace periods
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS default_grace_period_days INTEGER NOT NULL DEFAULT 3 CHECK (default_grace_period_days >= 0 AND default_grace_period_days <= 30);

ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS grace_period_days INTEGER NULL CHECK (grace_period_days >= 0 AND grace_period_days <= 30);

ALTER TABLE resellers
  ADD COLUMN IF NOT EXISTS grace_period_days INTEGER NULL CHECK (grace_period_days >= 0 AND grace_period_days <= 30);

-- 3. Failed MAC Authentication Attempts & Rejections Logging Table
CREATE TABLE IF NOT EXISTS subscriber_mac_auth_logs (
  id                BIGSERIAL PRIMARY KEY,
  subscriber_id     INTEGER REFERENCES subscribers(id) ON DELETE CASCADE,
  username          VARCHAR(64) NOT NULL,
  presented_mac     VARCHAR(32),
  expected_mac      VARCHAR(32),
  nas_ip            INET,
  nas_identifier    TEXT,
  status            VARCHAR(16) NOT NULL, -- 'rejected' | 'accepted' | 'bound'
  rejection_reason  TEXT NOT NULL,
  auth_date         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mac_auth_sub ON subscriber_mac_auth_logs (subscriber_id, auth_date DESC);
CREATE INDEX IF NOT EXISTS idx_mac_auth_username ON subscriber_mac_auth_logs (lower(username), auth_date DESC);

-- 4. PostgreSQL Trigger Function on radpostauth for Auto-Binding & Real-time Mismatch Tracking
CREATE OR REPLACE FUNCTION handle_radpostauth_mac_binding()
RETURNS TRIGGER AS $$
DECLARE
  v_sub RECORD;
  v_raw_mac TEXT;
  v_norm_mac TEXT;
  v_m TEXT[];
  v_reason TEXT;
BEGIN
  IF NEW.username IS NULL OR NEW.username = '' THEN
    RETURN NEW;
  END IF;

  -- Lookup subscriber
  SELECT id, username, status, mac_binding_enabled, mac_address, expiry_date, grace_status, grace_end_date
    INTO v_sub
    FROM subscribers
   WHERE lower(username) = lower(NEW.username);

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Extract and normalize CallingStationId (supports MikroTik, Juniper, Cisco dot, hyphen, raw hex)
  v_raw_mac := TRIM(COALESCE(NEW.CallingStationId, ''));
  v_norm_mac := NULL;

  IF v_raw_mac ~* '([0-9a-f]{2})[-:.]?([0-9a-f]{2})[-:.]?([0-9a-f]{2})[-:.]?([0-9a-f]{2})[-:.]?([0-9a-f]{2})[-:.]?([0-9a-f]{2})' THEN
    v_m := regexp_matches(v_raw_mac, '([0-9a-f]{2})[-:.]?([0-9a-f]{2})[-:.]?([0-9a-f]{2})[-:.]?([0-9a-f]{2})[-:.]?([0-9a-f]{2})[-:.]?([0-9a-f]{2})', 'i');
    v_norm_mac := UPPER(v_m[1] || ':' || v_m[2] || ':' || v_m[3] || ':' || v_m[4] || ':' || v_m[5] || ':' || v_m[6]);
  END IF;

  -- CASE 1: Successful Login -> Auto-bind first login MAC if enabled and unbound
  IF NEW.reply = 'Access-Accept' THEN
    IF v_sub.mac_binding_enabled = TRUE AND v_sub.mac_address IS NULL AND v_norm_mac IS NOT NULL THEN
      UPDATE subscribers
         SET mac_address = v_norm_mac,
             mac_bound_at = NOW(),
             mac_bound_by = 'auto_first_login',
             updated_at = NOW()
       WHERE id = v_sub.id AND mac_address IS NULL;

      IF FOUND THEN
        -- Insert Calling-Station-Id into radcheck for future enforcement
        DELETE FROM radcheck WHERE lower(username) = lower(v_sub.username) AND attribute = 'Calling-Station-Id';
        INSERT INTO radcheck (username, attribute, op, value)
        VALUES (lower(v_sub.username), 'Calling-Station-Id', '==', v_norm_mac);

        -- Record binding event
        INSERT INTO subscriber_mac_auth_logs (
          subscriber_id, username, presented_mac, expected_mac, nas_identifier, status, rejection_reason, auth_date
        ) VALUES (
          v_sub.id, v_sub.username, v_norm_mac, v_norm_mac, NEW.CalledStationId, 'bound', 'MAC automatically bound on first successful login', NOW()
        );
      END IF;
    END IF;

  -- CASE 2: Rejected Login -> Identify MAC mismatch or policy violation
  ELSIF NEW.reply = 'Access-Reject' THEN
    IF v_sub.mac_binding_enabled = TRUE THEN
      IF v_raw_mac = '' OR v_norm_mac IS NULL THEN
        v_reason := 'Rejected: NAS did not supply a trustworthy MAC identifier (Calling-Station-Id missing or invalid)';
      ELSIF v_sub.mac_address IS NOT NULL AND v_norm_mac != UPPER(v_sub.mac_address) THEN
        v_reason := 'Rejected: MAC Mismatch (Expected ' || UPPER(v_sub.mac_address) || ', received ' || v_norm_mac || ')';
      ELSIF v_sub.status = 'suspended' THEN
        v_reason := 'Rejected: Account suspended';
      ELSIF v_sub.status = 'disabled' THEN
        v_reason := 'Rejected: Account disabled';
      ELSIF v_sub.expiry_date IS NOT NULL AND v_sub.expiry_date < NOW() AND (v_sub.grace_status != 'active' OR v_sub.grace_end_date < NOW()) THEN
        v_reason := 'Rejected: Subscription expired (no active grace period)';
      ELSE
        v_reason := 'Rejected: Authentication credentials mismatch or reject policy';
      END IF;

      INSERT INTO subscriber_mac_auth_logs (
        subscriber_id, username, presented_mac, expected_mac, nas_identifier, status, rejection_reason, auth_date
      ) VALUES (
        v_sub.id, v_sub.username, v_norm_mac, v_sub.mac_address, NEW.CalledStationId, 'rejected', v_reason, NOW()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_radpostauth_mac_binding ON radpostauth;
CREATE TRIGGER trg_radpostauth_mac_binding
  AFTER INSERT ON radpostauth
  FOR EACH ROW
  EXECUTE FUNCTION handle_radpostauth_mac_binding();

-- 5. Add RBAC permissions
INSERT INTO permissions (key, module, description) VALUES
  ('subscriber.mac_bind',           'subscribers',  'Manage customer MAC binding, manual locking and unbinding'),
  ('subscriber.grace',              'subscribers',  'Grant and revoke subscriber grace periods'),
  ('organization.grace_settings',   'organization', 'Configure organization and branch/reseller default grace duration')
ON CONFLICT (key) DO NOTHING;

-- Grant to super_admin, admin, and isp_admin roles
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
  WHERE r.name IN ('super_admin', 'admin', 'isp_admin', 'branch_manager')
  AND p.key IN ('subscriber.mac_bind', 'subscriber.grace', 'organization.grace_settings')
ON CONFLICT DO NOTHING;
