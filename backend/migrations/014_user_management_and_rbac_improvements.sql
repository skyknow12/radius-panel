-- =============================================================================
-- Migration 014: Improve User Management, Admin Roles & Data Access Control
-- =============================================================================

-- 1. Extend users table constraints and columns
DO $$
BEGIN
  -- Expand data_scope check constraint safely
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_data_scope_check;
  ALTER TABLE users ADD CONSTRAINT users_data_scope_check
    CHECK (data_scope IN ('PLATFORM', 'ORGANIZATION', 'HEAD_OFFICE', 'BRANCH', 'RESELLER', 'OWN_RECORDS', 'GLOBAL', 'OWN'));

  -- Add optional notes/remarks column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'notes'
  ) THEN
    ALTER TABLE users ADD COLUMN notes TEXT;
  END IF;

  -- Add is_active column on roles table if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'roles' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE roles ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;
END $$;

-- 2. Register distinct administrative roles:
--    - super_admin: Developer-only platform ownership role
--    - isp_admin: ISP owner / operational administrator with organization-wide control
INSERT INTO roles (name, display_name, description, is_system, is_active) VALUES
  ('super_admin',        'Super Administrator', 'Software developer & platform owner with full technical diagnostics and platform configuration', TRUE, TRUE),
  ('isp_admin',          'ISP Administrator',   'ISP owner and senior operational administrator with full control over ISP organization and operations', TRUE, TRUE),
  ('organization_admin', 'Organization Admin',  'Operational administrator alias with organization-wide operational control', TRUE, TRUE),
  ('branch_admin',       'Branch Admin',        'Management access restricted to own branch subscribers, staff and wallet', TRUE, TRUE),
  ('branch_operator',    'Branch Operator',     'Operational access for own branch recharges and subscriber support', TRUE, TRUE),
  ('reseller_admin',     'Reseller Admin',      'Full management of own reseller customers, wallet, and sub-users', TRUE, TRUE),
  ('reseller_operator',  'Reseller Operator',   'Operations access to recharge own customers using reseller wallet', TRUE, TRUE),
  ('noc_head',           'NOC Head',            'Manage network infrastructure, BNGs, alerts, and NOC staff', TRUE, TRUE),
  ('noc_operator',       'NOC Operator',        'Monitor network, view sessions, and diagnose RADIUS events', TRUE, TRUE),
  ('billing_admin',      'Billing Admin',       'Full financial, recharge, invoice, discount, and report control', TRUE, TRUE),
  ('support_operator',   'Support Operator',    'Handle customer complaints, tickets, diagnostic probes, and CRM notes', TRUE, TRUE),
  ('read_only',          'Read Only',           'Read-only visibility across authorized views with zero modifications', TRUE, TRUE)
ON CONFLICT (name) DO UPDATE SET 
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_active = TRUE;

-- 3. Register Granular Permissions across all 24 operational modules
INSERT INTO permissions (key, module, description) VALUES
  -- Developer & Platform Only
  ('system.developer_config',     'system',        'Access developer-only settings and technical configuration'),
  ('system.diagnostics',          'system',        'Access developer system diagnostics, raw socket tests, and recovery tools'),
  ('system.database_tools',       'system',        'Access database migration and schema management tools'),
  ('platform.organizations.manage','system',       'Manage platform-level multi-organization entities'),

  -- Dashboard
  ('dashboard.view',              'dashboard',     'View general dashboard metrics and widgets'),
  ('dashboard.export',            'dashboard',     'Export dashboard summaries and KPIs'),

  -- User Management
  ('users.view',                  'users',         'View staff user accounts and login records'),
  ('users.create',                'users',         'Create new staff user accounts'),
  ('users.edit',                  'users',         'Edit user accounts and information'),
  ('users.disable',               'users',         'Disable, enable, or suspend user accounts'),
  ('users.delete',                'users',         'Permanently delete user accounts where safe'),
  ('users.reset_password',        'users',         'Reset user passwords and force password resets'),
  ('users.force_logout',          'users',         'Force terminate user active sessions'),
  ('users.export',                'users',         'Export staff user directory to CSV/Excel'),

  -- Role Management
  ('roles.view',                  'roles',         'View role definitions and assigned permissions'),
  ('roles.create',                'roles',         'Create custom operational roles'),
  ('roles.edit',                  'roles',         'Modify roles and permission mappings'),
  ('roles.delete',                'roles',         'Delete custom roles'),
  ('roles.assign',                'roles',         'Assign roles to user accounts'),

  -- Organization
  ('organization.view',           'organization', 'View ISP organization profiles and metrics'),
  ('organization.edit',           'organization', 'Configure organization details, branding and settings'),
  ('organization.report',         'organization', 'Generate organization-level consolidated reports'),

  -- Branches
  ('branch.view',                 'branch',       'View branch listing, profiles and statistics'),
  ('branch.create',               'branch',       'Create new branch locations'),
  ('branch.edit',                 'branch',       'Update branch details and operational statuses'),
  ('branch.delete',               'branch',       'Deactivate or remove branch entities'),
  ('branch.report',               'branch',       'Generate branch-level performance and financial reports'),

  -- Resellers
  ('reseller.view',               'reseller',     'View reseller accounts, profiles and commissions'),
  ('reseller.create',             'reseller',     'Onboard new reseller accounts'),
  ('reseller.edit',               'reseller',     'Modify reseller configuration and commission models'),
  ('reseller.suspend',            'reseller',     'Suspend or reactivate reseller access'),
  ('reseller.delete',             'reseller',     'Delete or deactivate reseller accounts'),
  ('reseller.report',             'reseller',     'Generate reseller sales, recharge and commission reports'),
  ('reseller.pricing.view',       'reseller',     'View reseller custom package pricing overrides'),
  ('reseller.pricing.edit',       'reseller',     'Configure reseller custom package pricing overrides'),

  -- Subscribers
  ('subscriber.view',             'subscribers',   'View subscribers and profiles'),
  ('subscriber.create',           'subscribers',   'Register new subscriber accounts'),
  ('subscriber.edit',             'subscribers',   'Modify subscriber account details and credentials'),
  ('subscriber.activate',         'subscribers',   'Activate subscriber internet access'),
  ('subscriber.suspend',          'subscribers',   'Suspend subscriber internet access'),
  ('subscriber.resume',           'subscribers',   'Resume subscriber internet access'),
  ('subscriber.terminate',        'subscribers',   'Terminate subscriber accounts'),
  ('subscriber.recharge',         'subscribers',   'Perform service recharge for subscribers'),
  ('subscriber.change_package',   'subscribers',   'Change subscriber service package tier'),
  ('subscriber.change_speed',     'subscribers',   'Modify subscriber dynamic speed limit via CoA'),
  ('subscriber.change_ip',        'subscribers',   'Assign or modify static IP addresses'),
  ('subscriber.export',           'subscribers',   'Export subscriber database to CSV'),

  -- Packages
  ('package.view',                'packages',      'View bandwidth service packages'),
  ('package.create',              'packages',      'Create new bandwidth service packages'),
  ('package.edit',                'packages',      'Modify bandwidth package configurations and rates'),
  ('package.delete',              'packages',      'Deactivate or delete service packages'),
  ('package.price',               'packages',      'Configure multi-duration pricing tiers'),

  -- RADIUS & NAS
  ('radius.view',                 'radius',        'View RADIUS server status and activity'),
  ('radius.test',                 'radius',        'Execute synthetic RADIUS authentication tests'),
  ('radius.disconnect',           'radius',        'Send Disconnect-Request (PoD) packets'),
  ('radius.coa',                  'radius',        'Send Change-of-Authorization (CoA) packets'),
  ('nas.view',                    'nas',           'View NAS / BNG gateway inventory'),
  ('nas.create',                  'nas',           'Add NAS / BNG gateway devices'),
  ('nas.edit',                    'nas',           'Update NAS / BNG gateway settings and secrets'),
  ('nas.delete',                  'nas',           'Remove NAS / BNG gateway devices'),

  -- Sessions, Auth Logs & Accounting
  ('sessions.view',               'sessions',      'View active online subscriber sessions'),
  ('sessions.disconnect',         'sessions',      'Terminate subscriber active sessions'),
  ('sessions.export',             'sessions',      'Export active session lists to CSV'),
  ('auth_logs.view',              'auth_logs',     'View live RADIUS authentication attempts'),
  ('auth_logs.export',            'auth_logs',     'Export authentication log records to CSV'),
  ('accounting.view',             'accounting',    'View FreeRADIUS accounting session history'),
  ('accounting.export',           'accounting',    'Export accounting records to CSV'),

  -- Billing & Financials
  ('billing.view',                'billing',       'View financial invoices, receipts and revenue summaries'),
  ('billing.recharge',            'billing',       'Process subscriber renewals and recharges'),
  ('billing.discount',            'billing',       'Apply promotional discounts on recharges'),
  ('billing.adjustment',          'billing',       'Apply manual financial credit and debit adjustments'),
  ('billing.refund',              'billing',       'Process service refunds and transaction reversals'),
  ('billing.invoice',             'billing',       'Generate and download tax invoices'),
  ('billing.receipt',             'billing',       'Issue customer payment receipts'),
  ('billing.report',              'billing',       'View comprehensive financial sales reports'),
  ('billing.export',              'billing',       'Export billing transactions and ledger records'),

  -- Wallets & Credit
  ('wallet.view',                 'wallets',       'View channel wallet balances and ledgers'),
  ('wallet.topup',                'wallets',       'Perform cash and credit wallet balance top-ups'),
  ('wallet.debit',                'wallets',       'Debit wallet balances for transactions'),
  ('wallet.adjust',               'wallets',       'Reconcile and adjust wallet balances'),
  ('wallet.refund',               'wallets',       'Reverse and refund wallet balance debits'),
  ('wallet.report',               'wallets',       'Generate wallet transactions and balance audit reports'),
  ('reseller.wallet.view',        'wallets',       'View reseller wallet balance and transaction ledger'),
  ('reseller.wallet.topup',       'wallets',       'Add balance to reseller wallet (Cash & Credit)'),
  ('reseller.wallet.adjust',      'wallets',       'Manually adjust reseller balance'),
  ('reseller.wallet.refund',      'wallets',       'Process refund on reseller wallet'),
  ('credit.view',                 'credit',        'View credit facilities and limits'),
  ('credit.create',               'credit',        'Grant credit top-up to channels'),
  ('credit.edit',                 'credit',        'Adjust credit limits and terms'),
  ('credit.suspend',              'credit',        'Freeze or suspend credit facilities'),
  ('reseller.credit.view',        'credit',        'View reseller credit facility and used credit'),
  ('reseller.credit.create',      'credit',        'Grant credit top-up to reseller'),
  ('reseller.credit.adjust',      'credit',        'Adjust reseller credit limit'),
  ('reseller.credit.suspend',     'credit',        'Suspend reseller credit facility'),
  ('reseller.credit.override',    'credit',        'Override credit limit during top-up'),

  -- Commission & Pricing
  ('commission.view',             'commission',    'View reseller commission percentages and rates'),
  ('commission.report',           'commission',    'View reseller commission earnings ledger and reports'),
  ('commission.payout',           'commission',    'Process commission settlements and payouts'),
  ('pricing.view',                'pricing',       'View channel pricing rules and tier overrides'),
  ('pricing.edit',                'pricing',       'Configure channel pricing rules and tier overrides'),
  ('pricing.discount',            'pricing',       'Configure channel discount rules'),
  ('pricing.commission',          'pricing',       'Configure reseller commission percentages'),

  -- Reports
  ('reports.view',                'reports',       'View centralized ISP operational and analytical reports'),
  ('reports.export',              'reports',       'Export analytical reports to CSV or PDF'),

  -- CRM & Support Tickets
  ('crm.view',                    'crm',           'View customer CRM profile, history, and timeline'),
  ('crm.create',                  'crm',           'Add CRM notes and log customer communications'),
  ('crm.edit',                    'crm',           'Edit customer CRM notes and pinned items'),
  ('crm.delete',                  'crm',           'Delete customer CRM records'),
  ('tickets.view',                'tickets',       'View customer complaints and support tickets'),
  ('tickets.create',              'tickets',       'Create new customer support tickets'),
  ('tickets.edit',                'tickets',       'Update ticket subject, description and priority'),
  ('tickets.assign',              'tickets',       'Assign tickets to staff and field technicians'),
  ('tickets.comment',             'tickets',       'Post internal and public ticket comments'),
  ('tickets.close',               'tickets',       'Resolve and close support tickets'),
  ('tickets.reopen',              'tickets',       'Reopen resolved or closed support tickets'),
  ('tickets.delete',              'tickets',       'Delete invalid or duplicate tickets'),

  -- Notifications, Audit Logs & Settings
  ('notifications.view',          'notifications', 'View received notifications and alerts'),
  ('notifications.create',        'notifications', 'Create and broadcast system notifications'),
  ('notifications.send',          'notifications', 'Send direct alerts to customers or staff'),
  ('notifications.manage',        'notifications', 'Configure automated notification triggers'),
  ('audit_logs.view',             'audit',         'View security audit trail logs'),
  ('audit_logs.export',           'audit',         'Export audit trail records to CSV'),
  ('settings.view',               'settings',      'View ISP operational settings and branding'),
  ('settings.edit',               'settings',      'Update ISP operational settings and policies'),
  ('settings.appearance',         'settings',      'Manage system themes and appearance'),
  ('settings.branding',           'settings',      'Manage ISP company name, logo and portal styling')
ON CONFLICT (key) DO UPDATE SET
  module = EXCLUDED.module,
  description = EXCLUDED.description;

-- 4. Grant All Permissions to Developer Super Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- 5. Grant Operational Permissions to ISP Administrator (EXCLUDING developer-only)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name IN ('isp_admin', 'organization_admin')
   AND p.key NOT IN (
     'system.developer_config',
     'system.diagnostics',
     'system.database_tools',
     'platform.organizations.manage'
   )
ON CONFLICT DO NOTHING;

-- 6. Grant Branch Admin Permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name = 'branch_admin'
   AND p.key IN (
     'dashboard.view',
     'users.view', 'users.create', 'users.edit', 'users.disable', 'users.reset_password', 'users.force_logout',
     'branch.view', 'branch.report',
     'subscriber.view', 'subscriber.create', 'subscriber.edit', 'subscriber.activate', 'subscriber.suspend', 'subscriber.resume', 'subscriber.recharge', 'subscriber.change_package', 'subscriber.change_speed',
     'package.view',
     'billing.view', 'billing.recharge', 'billing.invoice', 'billing.receipt',
     'wallet.view', 'wallet.report',
     'tickets.view', 'tickets.create', 'tickets.edit', 'tickets.assign', 'tickets.comment', 'tickets.close', 'tickets.reopen',
     'crm.view', 'crm.create', 'crm.edit',
     'notifications.view'
   )
ON CONFLICT DO NOTHING;

-- 7. Grant Branch Operator Permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name = 'branch_operator'
   AND p.key IN (
     'dashboard.view',
     'subscriber.view', 'subscriber.recharge',
     'package.view',
     'billing.view', 'billing.receipt',
     'tickets.view', 'tickets.create', 'tickets.comment',
     'crm.view', 'crm.create',
     'notifications.view'
   )
ON CONFLICT DO NOTHING;

-- 8. Grant Reseller Admin Permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name = 'reseller_admin'
   AND p.key IN (
     'dashboard.view',
     'users.view', 'users.create', 'users.edit', 'users.disable', 'users.reset_password', 'users.force_logout',
     'reseller.view', 'reseller.report',
     'subscriber.view', 'subscriber.create', 'subscriber.edit', 'subscriber.activate', 'subscriber.suspend', 'subscriber.resume', 'subscriber.recharge', 'subscriber.change_package',
     'package.view', 'reseller.pricing.view',
     'reseller.wallet.view', 'reseller.credit.view', 'commission.view', 'commission.report',
     'tickets.view', 'tickets.create', 'tickets.comment', 'tickets.close',
     'crm.view', 'crm.create',
     'notifications.view'
   )
ON CONFLICT DO NOTHING;

-- 9. Grant Reseller Operator Permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name = 'reseller_operator'
   AND p.key IN (
     'dashboard.view',
     'subscriber.view', 'subscriber.recharge',
     'package.view',
     'reseller.wallet.view',
     'tickets.view', 'tickets.create', 'tickets.comment',
     'notifications.view'
   )
ON CONFLICT DO NOTHING;

-- 10. Update developer super admin account scope to 'PLATFORM'
UPDATE users 
   SET data_scope = 'PLATFORM'
 WHERE role_id = (SELECT id FROM roles WHERE name = 'super_admin' LIMIT 1);
