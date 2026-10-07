-- =============================================================================
--  RADIUS PRO — Migration 001: application core schema
--
--  Application tables (separate from the FreeRADIUS tables in postgres/init):
--    roles, permissions, role_permissions, users,
--    nas_devices, system_settings, audit_logs
--
--  Customer / package / billing tables are intentionally NOT part of Phase 1.
-- =============================================================================

-- Shared trigger to maintain updated_at columns
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
	NEW.updated_at = NOW();
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
--  roles
-- -----------------------------------------------------------------------------
CREATE TABLE roles (
	id            SERIAL PRIMARY KEY,
	name          VARCHAR(64)  NOT NULL UNIQUE,
	display_name  VARCHAR(128) NOT NULL,
	description   TEXT,
	is_system     BOOLEAN      NOT NULL DEFAULT FALSE,
	created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
	updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE TRIGGER roles_updated_at BEFORE UPDATE ON roles
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
--  permissions  (key format: <module>.<action>, e.g. "radius.view")
-- -----------------------------------------------------------------------------
CREATE TABLE permissions (
	id           SERIAL PRIMARY KEY,
	key          VARCHAR(128) NOT NULL UNIQUE,
	module       VARCHAR(64)  NOT NULL,
	description  TEXT,
	created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX permissions_module_idx ON permissions (module);

CREATE TABLE role_permissions (
	role_id        INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
	permission_id  INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
	PRIMARY KEY (role_id, permission_id)
);

-- -----------------------------------------------------------------------------
--  users  (panel administrators / staff — NOT RADIUS subscribers)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
	id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
	username               VARCHAR(64)  NOT NULL UNIQUE,
	email                  VARCHAR(255) UNIQUE,
	full_name              VARCHAR(128),
	password_hash          TEXT         NOT NULL,
	role_id                INTEGER      NOT NULL REFERENCES roles(id),
	is_active              BOOLEAN      NOT NULL DEFAULT TRUE,
	last_login_at          TIMESTAMPTZ,
	last_login_ip          INET,
	failed_login_attempts  INTEGER      NOT NULL DEFAULT 0,
	locked_until           TIMESTAMPTZ,
	password_changed_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
	created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
	updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX users_role_idx ON users (role_id);
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
--  nas_devices  (panel-side NAS inventory; synced to FreeRADIUS "nas" later)
-- -----------------------------------------------------------------------------
CREATE TABLE nas_devices (
	id             SERIAL       PRIMARY KEY,
	name           VARCHAR(64)  NOT NULL UNIQUE,
	ip_address     INET         NOT NULL UNIQUE,
	nas_type       VARCHAR(32)  NOT NULL DEFAULT 'other',
	vendor         VARCHAR(64),
	model          VARCHAR(64),
	location       VARCHAR(128),
	description    TEXT,
	radius_nas_id  INTEGER,                       -- link to FreeRADIUS nas.id (Phase 2 sync)
	coa_port       INTEGER      NOT NULL DEFAULT 3799,
	status         VARCHAR(16)  NOT NULL DEFAULT 'unknown'
	               CHECK (status IN ('online', 'warning', 'offline', 'unknown')),
	last_seen_at   TIMESTAMPTZ,
	is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
	created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
	updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE TRIGGER nas_devices_updated_at BEFORE UPDATE ON nas_devices
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
--  system_settings  (key/value, JSONB values)
-- -----------------------------------------------------------------------------
CREATE TABLE system_settings (
	key          VARCHAR(128) PRIMARY KEY,
	value        JSONB        NOT NULL,
	category     VARCHAR(64)  NOT NULL DEFAULT 'general',
	description  TEXT,
	is_secret    BOOLEAN      NOT NULL DEFAULT FALSE,
	updated_by   UUID         REFERENCES users(id) ON DELETE SET NULL,
	created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
	updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE TRIGGER system_settings_updated_at BEFORE UPDATE ON system_settings
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
--  audit_logs
-- -----------------------------------------------------------------------------
CREATE TABLE audit_logs (
	id           BIGSERIAL    PRIMARY KEY,
	user_id      UUID         REFERENCES users(id) ON DELETE SET NULL,
	username     VARCHAR(64),
	action       VARCHAR(128) NOT NULL,
	entity_type  VARCHAR(64),
	entity_id    VARCHAR(128),
	status       VARCHAR(16)  NOT NULL DEFAULT 'success'
	             CHECK (status IN ('success', 'failure')),
	ip_address   INET,
	user_agent   TEXT,
	metadata     JSONB        NOT NULL DEFAULT '{}'::jsonb,
	created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX audit_logs_created_at_idx ON audit_logs (created_at DESC);
CREATE INDEX audit_logs_user_idx ON audit_logs (user_id);
CREATE INDEX audit_logs_action_idx ON audit_logs (action);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id);

-- =============================================================================
--  Seed: roles
-- =============================================================================
INSERT INTO roles (name, display_name, description, is_system) VALUES
	('super_admin', 'Super Administrator', 'Full unrestricted access to every module', TRUE),
	('admin',       'Administrator',       'Manage network, RADIUS and system configuration', TRUE),
	('operator',    'NOC Operator',        'Monitor network and RADIUS, run diagnostics', TRUE),
	('viewer',      'Viewer',              'Read-only dashboard access', TRUE);

-- =============================================================================
--  Seed: permissions (includes keys reserved for future modules)
-- =============================================================================
INSERT INTO permissions (key, module, description) VALUES
	('dashboard.view',     'dashboard', 'View the main dashboard'),
	('radius.view',        'radius',    'View RADIUS status, statistics and activity'),
	('radius.test',        'radius',    'Run RADIUS authentication tests'),
	('sessions.view',      'radius',    'View online sessions'),
	('sessions.disconnect','radius',    'Disconnect sessions (CoA / PoD)'),
	('nas.view',           'network',   'View NAS devices'),
	('nas.manage',         'network',   'Create / update / delete NAS devices'),
	('ippools.view',       'network',   'View IP pools'),
	('ippools.manage',     'network',   'Manage IP pools'),
	('customers.view',     'management','View customers'),
	('customers.manage',   'management','Manage customers'),
	('packages.view',      'management','View packages'),
	('packages.manage',    'management','Manage packages'),
	('billing.view',       'management','View billing'),
	('billing.manage',     'management','Manage billing'),
	('reports.view',       'reports',   'View reports'),
	('system.health',      'system',    'View system health'),
	('settings.view',      'system',    'View system settings'),
	('settings.manage',    'system',    'Change system settings'),
	('users.manage',       'system',    'Manage panel users and roles'),
	('audit.view',         'system',    'View audit logs');

-- super_admin + admin: everything
INSERT INTO role_permissions (role_id, permission_id)
	SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
	WHERE r.name IN ('super_admin', 'admin');

-- operator: monitoring + diagnostics
INSERT INTO role_permissions (role_id, permission_id)
	SELECT r.id, p.id FROM roles r JOIN permissions p ON p.key IN (
		'dashboard.view', 'radius.view', 'radius.test', 'sessions.view',
		'nas.view', 'ippools.view', 'customers.view', 'packages.view',
		'reports.view', 'system.health'
	) WHERE r.name = 'operator';

-- viewer: read-only
INSERT INTO role_permissions (role_id, permission_id)
	SELECT r.id, p.id FROM roles r JOIN permissions p ON p.key IN (
		'dashboard.view', 'radius.view', 'sessions.view', 'nas.view', 'system.health'
	) WHERE r.name = 'viewer';

-- =============================================================================
--  Seed: system settings
-- =============================================================================
INSERT INTO system_settings (key, value, category, description) VALUES
	('company.name',      '"RADIUS PRO ISP"',  'general', 'Company / ISP display name'),
	('company.currency',  '"NPR"',             'general', 'Default currency code'),
	('company.timezone',  '"Asia/Kathmandu"',  'general', 'Default timezone'),
	('radius.session_stale_minutes', '15',     'radius',  'Minutes without interim update before a session is considered stale'),
	('security.max_failed_logins',  '5',       'security','Failed logins before temporary lockout'),
	('security.lockout_minutes',    '15',      'security','Lockout duration in minutes');
