-- =============================================================================
-- Migration 019: Organization Settings, Safe Deletion & Bulk Import Exceptions
-- =============================================================================

-- 1. Soft Deletion & Audit Tracking for Users / Staff
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS users_deleted_at_idx ON users (deleted_at);

-- 2. Temporary Authentication Exception for Bulk Imported Customers
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS auth_exception_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS auth_exception_granted_at TIMESTAMPTZ NULL;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS auth_exception_granted_by VARCHAR(64) NULL;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS auth_exception_reason TEXT NULL;
CREATE INDEX IF NOT EXISTS subscribers_auth_exc_idx ON subscribers (auth_exception_enabled);

-- 3. Remove Channel Pricing completely (deprecated and unused)
DROP TABLE IF EXISTS channel_pricing_rules CASCADE;

-- Clean up channel pricing permissions from RBAC tables
DELETE FROM role_permissions WHERE permission_id IN (
  SELECT id FROM permissions WHERE key IN ('pricing.view', 'pricing.edit')
);
DELETE FROM permissions WHERE key IN ('pricing.view', 'pricing.edit');

-- 4. Ensure users.delete permission is seeded and assigned to administrator roles
INSERT INTO permissions (key, module, description)
VALUES ('users.delete', 'users', 'Permanently delete user accounts where safe')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('super_admin', 'isp_admin', 'admin', 'organization_admin')
  AND p.key = 'users.delete'
ON CONFLICT DO NOTHING;
