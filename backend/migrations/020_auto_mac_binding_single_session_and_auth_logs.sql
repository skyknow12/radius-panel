-- =============================================================================
-- Migration 020: Automatic MAC Binding, Single-Session Enforcement & Auth Logs
-- =============================================================================

-- 1. Ensure mac_binding_enabled defaults to TRUE for all subscribers
ALTER TABLE subscribers
  ALTER COLUMN mac_binding_enabled SET DEFAULT true;

UPDATE subscribers
   SET mac_binding_enabled = true
 WHERE mac_binding_enabled = false;

-- 2. Extend radpostauth with troubleshooting metadata columns
ALTER TABLE radpostauth
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS attempted_mac VARCHAR(32),
  ADD COLUMN IF NOT EXISTS bound_mac VARCHAR(32),
  ADD COLUMN IF NOT EXISTS nas_ip INET,
  ADD COLUMN IF NOT EXISTS nas_identifier TEXT,
  ADD COLUMN IF NOT EXISTS nas_port TEXT,
  ADD COLUMN IF NOT EXISTS session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_radpostauth_reason ON radpostauth (reason);
CREATE INDEX IF NOT EXISTS idx_radpostauth_attempted_mac ON radpostauth (attempted_mac);
CREATE INDEX IF NOT EXISTS idx_radpostauth_bound_mac ON radpostauth (bound_mac);

-- 3. Stale Session Identification and Cleanup Function
-- Closes sessions that have received no interim accounting updates for > 15 minutes.
CREATE OR REPLACE FUNCTION cleanup_stale_radacct_sessions()
RETURNS INTEGER AS $$
DECLARE
  v_closed INTEGER := 0;
BEGIN
  UPDATE radacct
     SET AcctStopTime = COALESCE(AcctUpdateTime, AcctStartTime + INTERVAL '10 minutes', NOW()),
         AcctTerminateCause = 'Stale-Session-Timeout'
   WHERE AcctStopTime IS NULL
     AND (
       (AcctUpdateTime IS NOT NULL AND AcctUpdateTime < NOW() - INTERVAL '15 minutes')
       OR (AcctUpdateTime IS NULL AND AcctStartTime < NOW() - INTERVAL '15 minutes')
     );
  GET DIAGNOSTICS v_closed = ROW_COUNT;
  RETURN v_closed;
END;
$$ LANGUAGE plpgsql;

-- 4. Radacct Single Active Session Enforcement Trigger
-- When a new session start arrives for a user, mark any prior unclosed session closed
CREATE OR REPLACE FUNCTION trg_radacct_single_session()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.AcctStopTime IS NULL AND NEW.UserName IS NOT NULL AND NEW.UserName != '' THEN
    UPDATE radacct
       SET AcctStopTime = COALESCE(NEW.AcctStartTime, NOW()),
           AcctTerminateCause = 'Session-Replaced'
     WHERE lower(UserName) = lower(NEW.UserName)
       AND RadAcctId != NEW.RadAcctId
       AND AcctStopTime IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_radacct_single_session_enforce ON radacct;
CREATE TRIGGER trg_radacct_single_session_enforce
  AFTER INSERT ON radacct
  FOR EACH ROW
  EXECUTE FUNCTION trg_radacct_single_session();

-- 5. Trigger Function on radpostauth: Automatic MAC Binding, Accurate Rejection Reasons & Password Sanitization
CREATE OR REPLACE FUNCTION handle_radpostauth_mac_binding()
RETURNS TRIGGER AS $$
DECLARE
  v_sub RECORD;
  v_raw_mac TEXT;
  v_norm_mac TEXT;
  v_m TEXT[];
  v_active_sessions INTEGER := 0;
BEGIN
  -- Always wipe any credential secrets from radpostauth
  NEW.pass := NULL;

  IF NEW.username IS NULL OR NEW.username = '' THEN
    NEW.reason := 'Unknown: Missing Username';
    RETURN NEW;
  END IF;

  -- Extract and normalize MAC from CallingStationId
  v_raw_mac := TRIM(COALESCE(NEW.CallingStationId, ''));
  v_norm_mac := NULL;

  IF v_raw_mac ~* '([0-9a-f]{2})[-:.]?([0-9a-f]{2})[-:.]?([0-9a-f]{2})[-:.]?([0-9a-f]{2})[-:.]?([0-9a-f]{2})[-:.]?([0-9a-f]{2})' THEN
    v_m := regexp_matches(v_raw_mac, '([0-9a-f]{2})[-:.]?([0-9a-f]{2})[-:.]?([0-9a-f]{2})[-:.]?([0-9a-f]{2})[-:.]?([0-9a-f]{2})[-:.]?([0-9a-f]{2})', 'i');
    v_norm_mac := UPPER(v_m[1] || ':' || v_m[2] || ':' || v_m[3] || ':' || v_m[4] || ':' || v_m[5] || ':' || v_m[6]);
  END IF;

  NEW.attempted_mac := v_norm_mac;
  NEW.nas_identifier := COALESCE(NEW.CalledStationId, '');

  -- Lookup subscriber
  SELECT id, username, status, mac_binding_enabled, mac_address, expiry_date, grace_status, grace_end_date
    INTO v_sub
    FROM subscribers
   WHERE lower(username) = lower(NEW.username);

  IF NOT FOUND THEN
    NEW.reason := 'User Not Found';
    RETURN NEW;
  END IF;

  NEW.bound_mac := v_sub.mac_address;

  -- =========================================================================
  -- CASE 1: Successful Login (Access-Accept)
  -- =========================================================================
  IF NEW.reply = 'Access-Accept' THEN
    -- If subscriber has no bound MAC yet: Concurrency-safe atomic auto-bind!
    IF v_sub.mac_address IS NULL THEN
      IF v_norm_mac IS NOT NULL THEN
        UPDATE subscribers
           SET mac_address = v_norm_mac,
               mac_bound_at = NOW(),
               mac_bound_by = 'auto_first_login',
               updated_at = NOW()
         WHERE id = v_sub.id AND mac_address IS NULL;

        IF FOUND THEN
          NEW.bound_mac := v_norm_mac;
          NEW.reason := 'Successful authentication (MAC automatically bound)';

          -- Insert Calling-Station-Id into radcheck for future strict enforcement
          DELETE FROM radcheck WHERE lower(username) = lower(v_sub.username) AND attribute = 'Calling-Station-Id';
          INSERT INTO radcheck (username, attribute, op, value)
          VALUES (lower(v_sub.username), 'Calling-Station-Id', '==', v_norm_mac);

          -- Record event in subscriber_mac_auth_logs
          INSERT INTO subscriber_mac_auth_logs (
            subscriber_id, username, presented_mac, expected_mac, nas_identifier, status, rejection_reason, auth_date
          ) VALUES (
            v_sub.id, v_sub.username, v_norm_mac, v_norm_mac, NEW.CalledStationId, 'bound', 'MAC automatically bound on first successful login', NOW()
          );

          -- Record in audit_logs
          INSERT INTO audit_logs (username, action, entity_type, entity_id, status, metadata, created_at)
          VALUES (v_sub.username, 'subscriber.mac_bound', 'subscriber', v_sub.id::text, 'success',
                  json_build_object('mac_address', v_norm_mac, 'source', 'auto_first_login', 'timestamp', NOW()), NOW());

          -- Record in subscriber_activity_logs
          INSERT INTO subscriber_activity_logs (subscriber_id, action, details, admin_username, created_at)
          VALUES (v_sub.id, 'mac_bound', 'MAC address automatically bound on first successful login: ' || v_norm_mac, 'auto_first_login', NOW());
        ELSE
          NEW.reason := 'Successful authentication';
        END IF;
      ELSE
        -- NAS did not supply a reliable MAC identifier: Report limitation and defer binding
        NEW.reason := 'Successful authentication (Warning: NAS did not supply a valid MAC identifier - binding deferred)';
      END IF;
    ELSE
      NEW.reason := 'Successful authentication';
    END IF;

  -- =========================================================================
  -- CASE 2: Rejected Login (Access-Reject)
  -- =========================================================================
  ELSIF NEW.reply = 'Access-Reject' THEN
    -- Check for Active Concurrent Session
    SELECT COUNT(*) INTO v_active_sessions
      FROM radacct
     WHERE lower(UserName) = lower(NEW.username)
       AND AcctStopTime IS NULL
       AND (
         (AcctUpdateTime IS NOT NULL AND AcctUpdateTime > NOW() - INTERVAL '15 minutes')
         OR (AcctUpdateTime IS NULL AND AcctStartTime > NOW() - INTERVAL '15 minutes')
       );

    IF v_sub.status = 'disabled' THEN
      NEW.reason := 'Account Disabled';
    ELSIF v_sub.status = 'suspended' THEN
      NEW.reason := 'Account Suspended';
    ELSIF v_sub.expiry_date IS NOT NULL AND v_sub.expiry_date < NOW() AND (v_sub.grace_status != 'active' OR v_sub.grace_end_date < NOW()) THEN
      NEW.reason := 'Package or Account Expired';
    ELSIF v_sub.mac_address IS NOT NULL AND (v_norm_mac IS NULL OR v_norm_mac != UPPER(v_sub.mac_address)) THEN
      NEW.reason := 'Incorrect MAC Address';
    ELSIF v_active_sessions > 0 THEN
      NEW.reason := 'Existing Active Session';
    ELSE
      NEW.reason := 'Incorrect Password';
    END IF;

    -- Store in subscriber_mac_auth_logs for customer profile audit
    INSERT INTO subscriber_mac_auth_logs (
      subscriber_id, username, presented_mac, expected_mac, nas_identifier, status, rejection_reason, auth_date
    ) VALUES (
      v_sub.id, v_sub.username, v_norm_mac, v_sub.mac_address, NEW.CalledStationId, 'rejected', NEW.reason, NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Replace trigger on radpostauth: MUST be BEFORE INSERT so NEW columns (reason, attempted_mac, bound_mac) are saved on insert!
DROP TRIGGER IF EXISTS trg_radpostauth_mac_binding ON radpostauth;
CREATE TRIGGER trg_radpostauth_mac_binding
  BEFORE INSERT ON radpostauth
  FOR EACH ROW
  EXECUTE FUNCTION handle_radpostauth_mac_binding();

-- 6. Ensure Simultaneous-Use := 1 is present in radcheck for all subscribers
INSERT INTO radcheck (username, attribute, op, value)
SELECT lower(username), 'Simultaneous-Use', ':=', '1'
  FROM subscribers
 WHERE lower(username) NOT IN (
   SELECT lower(username) FROM radcheck WHERE attribute = 'Simultaneous-Use'
 );
