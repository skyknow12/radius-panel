-- =============================================================================
-- Migration 022: OLT Vendor Selection, Full SNMP Configuration & Real Telemetry
-- =============================================================================

-- 1. Extend olts table with complete SNMP configuration, health, and telemetry state
ALTER TABLE olts
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS snmp_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS snmp_write_community_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS snmp_timeout_ms INTEGER NOT NULL DEFAULT 3000,
  ADD COLUMN IF NOT EXISTS snmp_retries INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS last_poll_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_poll_status VARCHAR(24) DEFAULT 'unknown' CHECK (last_poll_status IN ('success', 'error', 'timeout', 'unknown')),
  ADD COLUMN IF NOT EXISTS last_poll_error TEXT,
  ADD COLUMN IF NOT EXISTS next_poll_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sys_uptime VARCHAR(64),
  ADD COLUMN IF NOT EXISTS sys_descr TEXT,
  ADD COLUMN IF NOT EXISTS sys_name VARCHAR(128),
  ADD COLUMN IF NOT EXISTS sys_location VARCHAR(128),
  ADD COLUMN IF NOT EXISTS sys_contact VARCHAR(128),
  ADD COLUMN IF NOT EXISTS cpu_utilization NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS memory_utilization NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS temperature NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS fans_status VARCHAR(32),
  ADD COLUMN IF NOT EXISTS power_status VARCHAR(32),
  ADD COLUMN IF NOT EXISTS active_alarms_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS registered_onus_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS online_onus_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS telemetry_data JSONB DEFAULT '{}'::jsonb;

-- 2. Cleanly migrate existing OLT records
UPDATE olts SET vendor = 'Huawei' WHERE vendor IS NULL OR TRIM(vendor) = '';
UPDATE olts SET model = 'MA5683T' WHERE model IS NULL OR TRIM(model) = '';

-- 3. OLT Physical and Logical Interfaces Table
CREATE TABLE IF NOT EXISTS olt_interfaces (
  id              SERIAL PRIMARY KEY,
  olt_id          INTEGER NOT NULL REFERENCES olts(id) ON DELETE CASCADE,
  if_index        INTEGER NOT NULL,
  if_name         VARCHAR(64) NOT NULL,
  if_descr        VARCHAR(128),
  if_type         VARCHAR(64),
  admin_status    VARCHAR(16) NOT NULL DEFAULT 'unknown',
  oper_status     VARCHAR(16) NOT NULL DEFAULT 'unknown',
  speed_bps       BIGINT DEFAULT 0,
  mac_address     VARCHAR(32),
  mtu             INTEGER,
  in_octets       BIGINT DEFAULT 0,
  out_octets      BIGINT DEFAULT 0,
  in_rate_bps     BIGINT DEFAULT 0,
  out_rate_bps    BIGINT DEFAULT 0,
  in_errors       BIGINT DEFAULT 0,
  out_errors      BIGINT DEFAULT 0,
  in_discards     BIGINT DEFAULT 0,
  out_discards    BIGINT DEFAULT 0,
  last_change     TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_olt_if UNIQUE (olt_id, if_index)
);

CREATE INDEX IF NOT EXISTS idx_olt_if_olt_idx ON olt_interfaces (olt_id);
CREATE INDEX IF NOT EXISTS idx_olt_if_oper_status ON olt_interfaces (oper_status);

-- 4. OLT Alarms Table
CREATE TABLE IF NOT EXISTS olt_alarms (
  id              SERIAL PRIMARY KEY,
  olt_id          INTEGER NOT NULL REFERENCES olts(id) ON DELETE CASCADE,
  alarm_id        VARCHAR(64),
  severity        VARCHAR(16) NOT NULL DEFAULT 'warning' CHECK (severity IN ('critical', 'major', 'minor', 'warning', 'info')),
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  entity_type     VARCHAR(32),
  entity_id       VARCHAR(64),
  cleared         BOOLEAN NOT NULL DEFAULT FALSE,
  raised_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cleared_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_olt_alarms_olt_cleared ON olt_alarms (olt_id, cleared);
CREATE INDEX IF NOT EXISTS idx_olt_alarms_severity ON olt_alarms (severity);
