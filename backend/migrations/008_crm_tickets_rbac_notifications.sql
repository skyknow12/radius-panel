-- =============================================================================
--  MIGRATION 008: CRM, CUSTOMER SUPPORT, TICKETING, NOTIFICATIONS, RBAC & USER MANAGEMENT
-- =============================================================================

-- 1. Extend users table for Phase 7 fields
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone VARCHAR(32),
  ADD COLUMN IF NOT EXISTS status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS force_password_reset BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS data_scope VARCHAR(24) NOT NULL DEFAULT 'OWN' CHECK (data_scope IN ('GLOBAL', 'ORGANIZATION', 'BRANCH', 'RESELLER', 'OWN'));

CREATE INDEX IF NOT EXISTS users_status_idx ON users (status);
CREATE INDEX IF NOT EXISTS users_scope_idx ON users (data_scope);

-- Sync status column with is_active
UPDATE users SET status = CASE WHEN is_active = FALSE THEN 'INACTIVE' ELSE 'ACTIVE' END WHERE status IS NULL OR status = 'ACTIVE';

-- 2. Multi-role assignment support: user_roles
CREATE TABLE IF NOT EXISTS user_roles (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id      INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, role_id)
);
CREATE INDEX IF NOT EXISTS user_roles_user_idx ON user_roles (user_id);
CREATE INDEX IF NOT EXISTS user_roles_role_idx ON user_roles (role_id);

-- Backfill user_roles from users.role_id
INSERT INTO user_roles (user_id, role_id)
SELECT id, role_id FROM users
ON CONFLICT DO NOTHING;

-- 3. Login Sessions & Login History
CREATE TABLE IF NOT EXISTS login_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    VARCHAR(64),
  ip_address    INET,
  user_agent    TEXT,
  last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  is_revoked    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS login_sessions_user_idx ON login_sessions (user_id);
CREATE INDEX IF NOT EXISTS login_sessions_revoked_idx ON login_sessions (is_revoked);

CREATE TABLE IF NOT EXISTS login_history (
  id             BIGSERIAL PRIMARY KEY,
  user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  username       VARCHAR(64) NOT NULL,
  ip_address     INET,
  user_agent     TEXT,
  status         VARCHAR(24) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'LOCKED')),
  failure_reason VARCHAR(128),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS login_history_user_idx ON login_history (user_id);
CREATE INDEX IF NOT EXISTS login_history_created_idx ON login_history (created_at DESC);

-- 4. Seed Standard Default Roles
INSERT INTO roles (name, display_name, description, is_system) VALUES
  ('noc_head',          'NOC Head',            'Manage network infrastructure, BNGs, alerts, and NOC staff', TRUE),
  ('noc_operator',      'NOC Operator',        'Monitor network, view sessions, and diagnose RADIUS events', TRUE),
  ('billing_admin',     'Billing Admin',       'Full financial, recharge, invoice, discount, and report control', TRUE),
  ('support_operator',  'Support Operator',    'Handle customer complaints, tickets, diagnostic probes, and CRM notes', TRUE),
  ('read_only',         'Read Only',           'Read-only visibility across authorized views with zero modifications', TRUE)
ON CONFLICT (name) DO NOTHING;

-- 5. Seed Granular Permissions for Phase 7
INSERT INTO permissions (key, module, description) VALUES
  -- Dashboard
  ('dashboard.view',              'dashboard',     'View general dashboard metrics'),
  -- Users
  ('users.view',                  'users',         'View staff user accounts and login records'),
  ('users.create',                'users',         'Create new staff user accounts'),
  ('users.edit',                  'users',         'Edit user accounts and information'),
  ('users.disable',               'users',         'Disable, enable, or suspend user accounts'),
  ('users.delete',                'users',         'Permanently delete user accounts where safe'),
  ('users.reset_password',        'users',         'Reset user passwords and force password resets'),
  ('users.force_logout',          'users',         'Force terminate user active sessions'),
  -- Roles
  ('roles.view',                  'roles',         'View role definitions and assigned permissions'),
  ('roles.create',                'roles',         'Create custom roles'),
  ('roles.edit',                  'roles',         'Modify roles and permission mappings'),
  ('roles.delete',                'roles',         'Delete custom roles'),
  ('roles.assign',                'roles',         'Assign roles to user accounts'),
  -- Subscribers
  ('subscriber.view',             'subscribers',   'View subscribers and profiles'),
  ('subscriber.create',           'subscribers',   'Create new subscribers'),
  ('subscriber.edit',             'subscribers',   'Modify subscriber information'),
  ('subscriber.activate',         'subscribers',   'Activate subscriber accounts'),
  ('subscriber.suspend',          'subscribers',   'Suspend subscriber internet access'),
  ('subscriber.resume',           'subscribers',   'Resume subscriber internet access'),
  ('subscriber.terminate',        'subscribers',   'Terminate subscriber accounts'),
  ('subscriber.recharge',         'subscribers',   'Perform service recharge for subscribers'),
  ('subscriber.change_package',   'subscribers',   'Change subscriber service package'),
  ('subscriber.change_speed',     'subscribers',   'Modify subscriber dynamic speed limit'),
  ('subscriber.change_ip',        'subscribers',   'Assign or modify static IP addresses'),
  -- CRM
  ('crm.view',                    'crm',           'View customer CRM profile, history, and timeline'),
  ('crm.create',                  'crm',           'Add CRM notes and log communications'),
  ('crm.edit',                    'crm',           'Edit CRM notes and pin notes'),
  ('crm.delete',                  'crm',           'Delete customer CRM notes'),
  -- Tickets
  ('tickets.view',                'tickets',       'View customer complaints and support tickets'),
  ('tickets.create',              'tickets',       'Create new support tickets'),
  ('tickets.edit',                'tickets',       'Edit ticket subject, details, and category'),
  ('tickets.assign',              'tickets',       'Assign or reassign tickets to technicians'),
  ('tickets.comment',             'tickets',       'Post internal and public comments on tickets'),
  ('tickets.close',               'tickets',       'Resolve and close support tickets'),
  ('tickets.reopen',              'tickets',       'Reopen resolved or closed tickets'),
  ('tickets.delete',              'tickets',       'Delete invalid tickets'),
  -- Notifications
  ('notifications.view',          'notifications', 'View received notifications'),
  ('notifications.create',        'notifications', 'Create and broadcast system notifications'),
  ('notifications.send',          'notifications', 'Send direct messages and alerts'),
  ('notifications.manage',        'notifications', 'Configure notification templates and rules'),
  -- Audit & Settings
  ('audit_logs.view',             'audit',         'View security audit trail logs'),
  ('audit_logs.export',           'audit',         'Export audit trail records to CSV'),
  ('settings.view',               'settings',      'View system configuration settings'),
  ('settings.edit',               'settings',      'Modify system configuration settings')
ON CONFLICT (key) DO NOTHING;

-- Grant permissions to Super Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- Grant permissions to NOC Head
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name = 'noc_head'
   AND p.key IN (
     'dashboard.view', 'subscriber.view', 'subscriber.suspend', 'subscriber.resume',
     'subscriber.change_speed', 'radius.view', 'radius.test', 'radius.disconnect', 'radius.coa',
     'package.view', 'network.events', 'alerts.view', 'alerts.manage',
     'tickets.view', 'tickets.create', 'tickets.assign', 'tickets.comment', 'tickets.close',
     'crm.view', 'crm.create', 'notifications.view', 'audit_logs.view'
   )
ON CONFLICT DO NOTHING;

-- Grant permissions to Billing Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name = 'billing_admin'
   AND p.key IN (
     'dashboard.view', 'subscriber.view', 'subscriber.recharge',
     'package.view', 'package.price',
     'billing.view', 'billing.recharge', 'billing.discount', 'billing.adjustment',
     'billing.refund', 'billing.invoice', 'billing.receipt', 'billing.report', 'billing.export',
     'wallet.view', 'credit.view', 'pricing.view', 'commission.view', 'commission.report',
     'crm.view', 'crm.create', 'tickets.view', 'tickets.create', 'tickets.comment', 'notifications.view'
   )
ON CONFLICT DO NOTHING;

-- Grant permissions to Support Operator
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name = 'support_operator'
   AND p.key IN (
     'dashboard.view', 'subscriber.view', 'subscriber.recharge',
     'package.view', 'crm.view', 'crm.create', 'crm.edit',
     'tickets.view', 'tickets.create', 'tickets.comment', 'tickets.close', 'tickets.reopen',
     'notifications.view'
   )
ON CONFLICT DO NOTHING;

-- Grant permissions to Read Only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name IN ('read_only', 'viewer')
   AND p.key IN (
     'dashboard.view', 'subscriber.view', 'package.view', 'billing.view',
     'crm.view', 'tickets.view', 'notifications.view', 'reports.view'
   )
ON CONFLICT DO NOTHING;

-- 6. Customer CRM: Notes, Activities, Communications
CREATE TABLE IF NOT EXISTS crm_notes (
  id            SERIAL PRIMARY KEY,
  subscriber_id INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  author_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name   VARCHAR(128) NOT NULL DEFAULT 'System Staff',
  note          TEXT NOT NULL,
  is_pinned     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS crm_notes_sub_idx ON crm_notes (subscriber_id);
CREATE INDEX IF NOT EXISTS crm_notes_pinned_idx ON crm_notes (subscriber_id, is_pinned);

CREATE TABLE IF NOT EXISTS customer_activities (
  id            BIGSERIAL PRIMARY KEY,
  subscriber_id INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  actor_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name    VARCHAR(128) NOT NULL DEFAULT 'System',
  action_type   VARCHAR(64) NOT NULL,
  description   TEXT NOT NULL,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS customer_act_sub_idx ON customer_activities (subscriber_id, created_at DESC);
CREATE INDEX IF NOT EXISTS customer_act_type_idx ON customer_activities (action_type);

CREATE TABLE IF NOT EXISTS customer_communications (
  id            SERIAL PRIMARY KEY,
  subscriber_id INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  channel       VARCHAR(24) NOT NULL CHECK (channel IN ('IN_APP', 'SMS', 'EMAIL', 'WHATSAPP', 'CALL')),
  recipient     VARCHAR(128) NOT NULL,
  subject       VARCHAR(255),
  message       TEXT NOT NULL,
  status        VARCHAR(24) NOT NULL DEFAULT 'SENT' CHECK (status IN ('QUEUED', 'SENT', 'FAILED', 'DELIVERED')),
  sent_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS customer_comm_sub_idx ON customer_communications (subscriber_id, created_at DESC);

-- 7. Ticket Categories
CREATE TABLE IF NOT EXISTS ticket_categories (
  id                   SERIAL PRIMARY KEY,
  name                 VARCHAR(64) NOT NULL UNIQUE,
  description          TEXT,
  default_priority     VARCHAR(24) NOT NULL DEFAULT 'MEDIUM' CHECK (default_priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  default_sla_hours    INTEGER NOT NULL DEFAULT 12,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO ticket_categories (name, description, default_priority, default_sla_hours) VALUES
  ('No Internet',       'Complete loss of internet connectivity / link down', 'CRITICAL', 2),
  ('Slow Speed',        'Bandwidth throughput below subscribed rate limit',   'HIGH',     6),
  ('Wi-Fi Issue',       'Wireless signal degradation, SSID, or channel noise','MEDIUM',   12),
  ('LAN Issue',         'Local Ethernet cabling, PoE, or switch port issue',  'MEDIUM',   12),
  ('Installation',      'New connection drop fiber, ONU, and router setup',    'MEDIUM',   24),
  ('Package/Billing',   'Package change, validity renewal, or bill query',     'LOW',      24),
  ('Payment',           'Recharge verification, voucher, or bank transfer',   'LOW',      12),
  ('RADIUS/Login',      'Authentication rejected or MAC bind failure',        'HIGH',     4),
  ('IPTV',              'Set-top box stream freezing or multicast drop',      'MEDIUM',   12),
  ('CDN/Content',       'Buffering on YouTube, Netflix, or local cache',      'MEDIUM',   12),
  ('Fiber/Optical',     'High optical attenuation (> -27dBm) or cut fiber',   'CRITICAL', 4),
  ('Hardware',          'Damaged ONU / ONT router, power adapter fault',      'HIGH',     8),
  ('Service Request',   'Static IP allocation, shift of location, ONT upgrade','LOW',      48),
  ('Other',             'General customer feedback and inquiries',             'LOW',      48)
ON CONFLICT (name) DO NOTHING;

-- 8. Ticket SLA Rules
CREATE TABLE IF NOT EXISTS ticket_sla_rules (
  id                    SERIAL PRIMARY KEY,
  priority              VARCHAR(24) NOT NULL UNIQUE CHECK (priority IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  response_time_hours   INTEGER NOT NULL,
  resolution_time_hours INTEGER NOT NULL,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO ticket_sla_rules (priority, response_time_hours, resolution_time_hours) VALUES
  ('CRITICAL', 1, 4),
  ('HIGH',     2, 8),
  ('MEDIUM',   4, 12),
  ('LOW',      8, 24)
ON CONFLICT (priority) DO UPDATE
  SET response_time_hours = EXCLUDED.response_time_hours,
      resolution_time_hours = EXCLUDED.resolution_time_hours;

-- 9. Tickets
CREATE TABLE IF NOT EXISTS tickets (
  id                 SERIAL PRIMARY KEY,
  ticket_number      VARCHAR(32) NOT NULL UNIQUE,
  subscriber_id      INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  username           VARCHAR(64) NOT NULL,
  organization_id    INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  branch_id          INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  reseller_id        INTEGER REFERENCES resellers(id) ON DELETE SET NULL,
  category           VARCHAR(64) NOT NULL,
  subcategory        VARCHAR(64),
  subject            VARCHAR(255) NOT NULL,
  description        TEXT NOT NULL,
  priority           VARCHAR(24) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status             VARCHAR(24) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_INTERNAL', 'RESOLVED', 'CLOSED', 'REOPENED')),
  assigned_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_name    VARCHAR(128) NOT NULL DEFAULT 'System Staff',
  sla_deadline       TIMESTAMPTZ,
  first_response_at  TIMESTAMPTZ,
  resolved_at        TIMESTAMPTZ,
  closed_at          TIMESTAMPTZ,
  resolution         TEXT,
  internal_notes     TEXT,
  customer_notes     TEXT,
  escalation_count   INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS tickets_number_idx ON tickets (ticket_number);
CREATE INDEX IF NOT EXISTS tickets_sub_idx ON tickets (subscriber_id);
CREATE INDEX IF NOT EXISTS tickets_user_idx ON tickets (username);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets (status);
CREATE INDEX IF NOT EXISTS tickets_priority_idx ON tickets (priority);
CREATE INDEX IF NOT EXISTS tickets_branch_idx ON tickets (branch_id);
CREATE INDEX IF NOT EXISTS tickets_reseller_idx ON tickets (reseller_id);
CREATE INDEX IF NOT EXISTS tickets_assigned_idx ON tickets (assigned_user_id);
CREATE INDEX IF NOT EXISTS tickets_deadline_idx ON tickets (sla_deadline);

CREATE TABLE IF NOT EXISTS ticket_comments (
  id            SERIAL PRIMARY KEY,
  ticket_id     INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name   VARCHAR(128) NOT NULL,
  comment       TEXT NOT NULL,
  is_internal   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ticket_comments_ticket_idx ON ticket_comments (ticket_id, created_at ASC);

CREATE TABLE IF NOT EXISTS ticket_attachments (
  id            SERIAL PRIMARY KEY,
  ticket_id     INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  filename      VARCHAR(255) NOT NULL,
  file_url      TEXT NOT NULL,
  file_size     INTEGER,
  mime_type     VARCHAR(128),
  uploaded_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ticket_attach_ticket_idx ON ticket_attachments (ticket_id);

CREATE TABLE IF NOT EXISTS ticket_status_history (
  id              SERIAL PRIMARY KEY,
  ticket_id       INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  from_status     VARCHAR(24),
  to_status       VARCHAR(24) NOT NULL,
  changed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_by_name VARCHAR(128) NOT NULL DEFAULT 'System Staff',
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ticket_status_hist_ticket_idx ON ticket_status_history (ticket_id, created_at ASC);

CREATE TABLE IF NOT EXISTS ticket_escalations (
  id             SERIAL PRIMARY KEY,
  ticket_id      INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  escalated_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  from_priority  VARCHAR(24) NOT NULL,
  to_priority    VARCHAR(24) NOT NULL,
  reason         TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ticket_escalations_ticket_idx ON ticket_escalations (ticket_id);

-- 10. Notifications Architecture
CREATE TABLE IF NOT EXISTS notifications (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        VARCHAR(255) NOT NULL,
  message      TEXT NOT NULL,
  type         VARCHAR(32) NOT NULL DEFAULT 'INFO' CHECK (type IN ('INFO', 'SUCCESS', 'WARNING', 'CRITICAL', 'TICKET', 'BILLING')),
  category     VARCHAR(32) NOT NULL DEFAULT 'SYSTEM',
  action_url   TEXT,
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  read_at      TIMESTAMPTZ,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notif_user_unread_idx ON notifications (user_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_templates (
  id             SERIAL PRIMARY KEY,
  event_key      VARCHAR(64) NOT NULL UNIQUE,
  title_template VARCHAR(255) NOT NULL,
  body_template  TEXT NOT NULL,
  channels       VARCHAR(64)[] DEFAULT ARRAY['IN_APP'],
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO notification_templates (event_key, title_template, body_template) VALUES
  ('ticket.created',     'New Support Ticket #{ticket_number}',   'Customer {username} raised ticket: {subject} ({priority})'),
  ('ticket.assigned',    'Ticket #{ticket_number} Assigned',     'You were assigned ticket #{ticket_number} for customer {username}'),
  ('ticket.escalated',   'Ticket #{ticket_number} Escalated',    'Ticket #{ticket_number} escalated to {priority}: {reason}'),
  ('ticket.resolved',    'Ticket #{ticket_number} Resolved',     'Ticket #{ticket_number} for {username} marked resolved: {resolution}'),
  ('ticket.sla_breach',  'SLA Breach on #{ticket_number}',       'Ticket #{ticket_number} has breached resolution SLA deadline!'),
  ('recharge.success',   'Recharge Succeeded: {username}',       'Subscriber {username} recharged for {duration} month(s) - NPR {amount}'),
  ('wallet.topup',       'Wallet Funded: {name}',                'Wallet for {name} credited with NPR {amount}. New Balance: NPR {balance}'),
  ('wallet.low_balance', 'Low Wallet Balance Alert',             'Wallet balance for {name} is below threshold: NPR {balance}'),
  ('user.locked',        'Security Alert: User Locked',          'User account {username} locked after repeated failed login attempts')
ON CONFLICT (event_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS notification_preferences (
  id             SERIAL PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_key      VARCHAR(64) NOT NULL,
  in_app         BOOLEAN NOT NULL DEFAULT TRUE,
  email          BOOLEAN NOT NULL DEFAULT FALSE,
  sms            BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(user_id, event_key)
);

CREATE TABLE IF NOT EXISTS notification_delivery_logs (
  id              BIGSERIAL PRIMARY KEY,
  notification_id BIGINT REFERENCES notifications(id) ON DELETE SET NULL,
  channel         VARCHAR(24) NOT NULL,
  recipient       VARCHAR(255) NOT NULL,
  status          VARCHAR(24) NOT NULL CHECK (status IN ('SENT', 'FAILED', 'QUEUED')),
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notif_delivery_created_idx ON notification_delivery_logs (created_at DESC);

-- 11. Seed Initial Demo Tickets, CRM Notes, and Sample Notifications
DO $$
DECLARE
  v_sub_id INTEGER;
  v_sub_user VARCHAR(64);
  v_org_id INTEGER;
  v_branch_id INTEGER;
  v_admin_id UUID;
  v_ticket_id INTEGER;
BEGIN
  -- Get sample subscriber
  SELECT id, username, organization_id, branch_id INTO v_sub_id, v_sub_user, v_org_id, v_branch_id
    FROM subscribers
   ORDER BY id LIMIT 1;

  -- Get admin user
  SELECT id INTO v_admin_id FROM users WHERE username = 'admin' LIMIT 1;

  IF v_sub_id IS NOT NULL AND v_admin_id IS NOT NULL THEN
    -- Seed CRM Note
    INSERT INTO crm_notes (subscriber_id, author_id, author_name, note, is_pinned)
    VALUES (
      v_sub_id,
      v_admin_id,
      'Administrator',
      'Customer verified on optical fiber port ODF-02. Prefer morning communications. Optical power measured -19.4 dBm.',
      TRUE
    ) ON CONFLICT DO NOTHING;

    -- Seed Customer Activity
    INSERT INTO customer_activities (subscriber_id, actor_id, actor_name, action_type, description, metadata)
    VALUES (
      v_sub_id,
      v_admin_id,
      'System Admin',
      'CUSTOMER_ONBOARDED',
      'Subscriber service account and CRM profile established',
      '{"status": "ACTIVE"}'::jsonb
    ) ON CONFLICT DO NOTHING;

    -- Seed Demo Ticket
    INSERT INTO tickets (
      ticket_number, subscriber_id, username, organization_id, branch_id,
      category, subcategory, subject, description, priority, status,
      assigned_user_id, created_by_id, created_by_name, sla_deadline
    )
    VALUES (
      'TICK-' || to_char(NOW(), 'YYYYMMDD') || '-0001',
      v_sub_id,
      v_sub_user,
      v_org_id,
      v_branch_id,
      'Slow Speed',
      'Throughput Check',
      'Subscriber reported speed fluctuating during peak hours',
      'Customer reports download speed drops below 50 Mbps on 100 Mbps plan between 8 PM and 10 PM. Checked ONT optic RX: normal.',
      'HIGH',
      'IN_PROGRESS',
      v_admin_id,
      v_admin_id,
      'Support Team',
      NOW() + interval '8 hours'
    )
    ON CONFLICT (ticket_number) DO NOTHING
    RETURNING id INTO v_ticket_id;

    IF v_ticket_id IS NOT NULL THEN
      -- Seed Ticket Comment
      INSERT INTO ticket_comments (ticket_id, author_id, author_name, comment, is_internal)
      VALUES (
        v_ticket_id,
        v_admin_id,
        'NOC Engineer',
        'Checked BNG queue bandwidth and PON port utilization. Port utilization is at 42%. Scheduled remote Wi-Fi channel optimization.',
        TRUE
      );

      INSERT INTO ticket_status_history (ticket_id, from_status, to_status, changed_by, changed_by_name, reason)
      VALUES (
        v_ticket_id,
        'OPEN',
        'IN_PROGRESS',
        v_admin_id,
        'Administrator',
        'Investigation started on PON interface'
      );
    END IF;

    -- Seed sample notification for Admin
    INSERT INTO notifications (user_id, title, message, type, category, action_url)
    VALUES (
      v_admin_id,
      'Welcome to Phase 7: CRM & Support System',
      'Granular RBAC, customer ticketing, SLA management, and internal notification framework are now live.',
      'SUCCESS',
      'SYSTEM',
      '/tickets'
    );
  END IF;
END $$;
