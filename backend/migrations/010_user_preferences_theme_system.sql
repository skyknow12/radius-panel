-- =============================================================================
-- Migration 010: User Preferences, Multi-Theme System & Brand Logo Settings
-- =============================================================================

-- 1. Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id                SERIAL PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  theme             VARCHAR(32) NOT NULL DEFAULT 'light-pro' CHECK (theme IN ('default', 'dark-pro', 'light-pro', 'colorful', 'noc')),
  appearance_mode   VARCHAR(16) NOT NULL DEFAULT 'light' CHECK (appearance_mode IN ('dark', 'light', 'system')),
  sidebar_collapsed BOOLEAN NOT NULL DEFAULT FALSE,
  custom_settings   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_pref_user_id_idx ON user_preferences (user_id);

DROP TRIGGER IF EXISTS user_preferences_updated_at ON user_preferences;
CREATE TRIGGER user_preferences_updated_at BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. Ensure organizations table has logo_url, brand_name, brand_subtitle
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS brand_name VARCHAR(128) DEFAULT 'SKY RADIUS',
  ADD COLUMN IF NOT EXISTS brand_subtitle VARCHAR(128) DEFAULT 'ISP Operations';

-- Ensure default organization settings contains default_theme set to light-pro
UPDATE organizations
   SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{default_theme}', '"light-pro"'::jsonb, true);

-- 3. Register Permissions for Settings and Branding
INSERT INTO permissions (key, module, description) VALUES
  ('settings.view',     'settings', 'View application and system settings'),
  ('settings.edit',     'settings', 'Modify application appearance and system settings'),
  ('branding.edit',     'settings', 'Customize organization logo, brand name, and themes')
ON CONFLICT (key) DO NOTHING;

-- Grant permissions to admin, super_admin, organization_admin, operator roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name IN ('admin', 'super_admin', 'organization_admin', 'operator')
   AND p.key IN ('settings.view', 'settings.edit', 'branding.edit')
ON CONFLICT DO NOTHING;
