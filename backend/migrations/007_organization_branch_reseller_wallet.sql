-- =============================================================================
-- Migration 007: Phase 6 — Organization, Branch, Reseller, Wallet, Credit & Commission
-- =============================================================================

-- 1. Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(128) NOT NULL,
  code          VARCHAR(32) NOT NULL UNIQUE,
  logo_url      TEXT,
  address       TEXT,
  phone         VARCHAR(32),
  email         VARCHAR(128),
  website       VARCHAR(128),
  currency      VARCHAR(8) NOT NULL DEFAULT 'NPR',
  timezone      VARCHAR(64) NOT NULL DEFAULT 'Asia/Kathmandu',
  status        VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  settings      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS organizations_updated_at ON organizations;
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Insert Primary ISP Organization
INSERT INTO organizations (name, code, address, phone, email, website, currency, timezone, status, settings)
VALUES (
  'Sky Radius Broadband ISP',
  'SKY-ISP',
  'Central IT Park, Kathmandu, Nepal',
  '+977-1-4455667',
  'admin@skyradius.net',
  'https://skyradius.net',
  'NPR',
  'Asia/Kathmandu',
  'ACTIVE',
  '{"default_discount_model": "discount", "allow_negative_balance": false, "auto_recharge_enabled": true}'::jsonb
)
ON CONFLICT (code) DO NOTHING;

-- 2. Branches Table
CREATE TABLE IF NOT EXISTS branches (
  id              SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(128) NOT NULL,
  code            VARCHAR(32) NOT NULL UNIQUE,
  address         TEXT,
  contact_number  VARCHAR(32),
  email           VARCHAR(128),
  manager_name    VARCHAR(128),
  status          VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS branches_updated_at ON branches;
CREATE TRIGGER branches_updated_at BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Resellers Table
CREATE TABLE IF NOT EXISTS resellers (
  id                SERIAL PRIMARY KEY,
  organization_id   INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id         INTEGER NULL REFERENCES branches(id) ON DELETE SET NULL,
  name              VARCHAR(128) NOT NULL,
  code              VARCHAR(32) NOT NULL UNIQUE,
  contact_person    VARCHAR(128),
  phone             VARCHAR(32),
  email             VARCHAR(128),
  address           TEXT,
  status            VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  commission_model  VARCHAR(16) NOT NULL DEFAULT 'discount' CHECK (commission_model IN ('discount', 'commission')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS resellers_updated_at ON resellers;
CREATE TRIGGER resellers_updated_at BEFORE UPDATE ON resellers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. Extend users table for Branch and Reseller affiliation
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reseller_id INTEGER REFERENCES resellers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS employee_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS user_type VARCHAR(24) NOT NULL DEFAULT 'isp' CHECK (user_type IN ('isp', 'branch', 'reseller'));

CREATE INDEX IF NOT EXISTS users_org_idx ON users (organization_id);
CREATE INDEX IF NOT EXISTS users_branch_idx ON users (branch_id);
CREATE INDEX IF NOT EXISTS users_reseller_idx ON users (reseller_id);
CREATE INDEX IF NOT EXISTS users_utype_idx ON users (user_type);

-- 5. Extend subscribers table for Ownership
ALTER TABLE subscribers
  ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reseller_id INTEGER REFERENCES resellers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ownership_type VARCHAR(16) NOT NULL DEFAULT 'head_office' CHECK (ownership_type IN ('head_office', 'branch', 'reseller'));

CREATE INDEX IF NOT EXISTS subscribers_org_idx ON subscribers (organization_id);
CREATE INDEX IF NOT EXISTS subscribers_branch_idx ON subscribers (branch_id);
CREATE INDEX IF NOT EXISTS subscribers_reseller_idx ON subscribers (reseller_id);
CREATE INDEX IF NOT EXISTS subscribers_ownership_idx ON subscribers (ownership_type);

-- Backfill existing subscribers to default organization
UPDATE subscribers SET organization_id = (SELECT id FROM organizations WHERE code = 'SKY-ISP' LIMIT 1)
 WHERE organization_id IS NULL;

-- 6. Subscriber Ownership History
CREATE TABLE IF NOT EXISTS subscriber_ownership_history (
  id                      SERIAL PRIMARY KEY,
  subscriber_id           INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  previous_ownership_type VARCHAR(16) NOT NULL,
  previous_branch_id      INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  previous_reseller_id    INTEGER REFERENCES resellers(id) ON DELETE SET NULL,
  new_ownership_type      VARCHAR(16) NOT NULL,
  new_branch_id           INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  new_reseller_id         INTEGER REFERENCES resellers(id) ON DELETE SET NULL,
  changed_by              VARCHAR(64) NOT NULL,
  reason                  TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sub_own_hist_sub_idx ON subscriber_ownership_history (subscriber_id);
CREATE INDEX IF NOT EXISTS sub_own_hist_date_idx ON subscriber_ownership_history (created_at);

-- 7. Wallets Table
CREATE TABLE IF NOT EXISTS wallets (
  id              SERIAL PRIMARY KEY,
  wallet_number   VARCHAR(32) NOT NULL UNIQUE,
  entity_type     VARCHAR(16) NOT NULL CHECK (entity_type IN ('branch', 'reseller')),
  branch_id       INTEGER NULL REFERENCES branches(id) ON DELETE CASCADE,
  reseller_id     INTEGER NULL REFERENCES resellers(id) ON DELETE CASCADE,
  balance         NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
  total_topup     NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_used      NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_refund    NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_adjusted  NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  currency        VARCHAR(8) NOT NULL DEFAULT 'NPR',
  status          VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'LOCKED')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_branch_wallet UNIQUE (branch_id),
  CONSTRAINT uq_reseller_wallet UNIQUE (reseller_id),
  CONSTRAINT chk_wallet_target CHECK (
    (entity_type = 'branch' AND branch_id IS NOT NULL AND reseller_id IS NULL) OR
    (entity_type = 'reseller' AND reseller_id IS NOT NULL AND branch_id IS NULL)
  )
);

DROP TRIGGER IF EXISTS wallets_updated_at ON wallets;
CREATE TRIGGER wallets_updated_at BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS wallets_branch_idx ON wallets (branch_id);
CREATE INDEX IF NOT EXISTS wallets_reseller_idx ON wallets (reseller_id);

-- 8. Credit Accounts Table
CREATE TABLE IF NOT EXISTS credit_accounts (
  id              SERIAL PRIMARY KEY,
  wallet_id       INTEGER NOT NULL UNIQUE REFERENCES wallets(id) ON DELETE CASCADE,
  credit_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  credit_limit    NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (credit_limit >= 0),
  used_credit     NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (used_credit >= 0),
  start_date      DATE NULL,
  expiry_date     DATE NULL,
  status          VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'EXPIRED')),
  notes           TEXT,
  updated_by      VARCHAR(64) NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS credit_accounts_updated_at ON credit_accounts;
CREATE TRIGGER credit_accounts_updated_at BEFORE UPDATE ON credit_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 9. Wallet Transactions Table (Immutable Financial Ledger)
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id                  SERIAL PRIMARY KEY,
  transaction_id      VARCHAR(64) NOT NULL UNIQUE,
  wallet_id           INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  type                VARCHAR(24) NOT NULL CHECK (type IN ('TOP_UP', 'DEBIT', 'CREDIT', 'REFUND', 'ADJUSTMENT', 'REVERSAL')),
  amount              NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  balance_before      NUMERIC(12,2) NOT NULL,
  balance_after       NUMERIC(12,2) NOT NULL,
  credit_used_before  NUMERIC(12,2) NOT NULL DEFAULT 0,
  credit_used_after   NUMERIC(12,2) NOT NULL DEFAULT 0,
  reference           VARCHAR(128),
  payment_method      VARCHAR(32),
  reason              TEXT,
  idempotency_key     VARCHAR(128) UNIQUE,
  created_by          VARCHAR(64) NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wallet_tx_wlt_idx ON wallet_transactions (wallet_id);
CREATE INDEX IF NOT EXISTS wallet_tx_type_idx ON wallet_transactions (type);
CREATE INDEX IF NOT EXISTS wallet_tx_date_idx ON wallet_transactions (created_at);

-- 10. Channel Pricing & Commission Rules Table
CREATE TABLE IF NOT EXISTS channel_pricing_rules (
  id               SERIAL PRIMARY KEY,
  rule_name        VARCHAR(128) NOT NULL,
  channel_type     VARCHAR(16) NOT NULL CHECK (channel_type IN ('branch', 'reseller')),
  branch_id        INTEGER NULL REFERENCES branches(id) ON DELETE CASCADE,
  reseller_id      INTEGER NULL REFERENCES resellers(id) ON DELETE CASCADE,
  package_id       INTEGER NULL REFERENCES packages(id) ON DELETE CASCADE,
  duration_months  INTEGER NULL,
  rule_type        VARCHAR(24) NOT NULL CHECK (rule_type IN ('percentage_discount', 'percentage_commission', 'fixed_discount', 'fixed_override')),
  value            NUMERIC(10,2) NOT NULL CHECK (value >= 0),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  notes            TEXT,
  created_by       VARCHAR(64) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS channel_rules_chan_idx ON channel_pricing_rules (channel_type);
CREATE INDEX IF NOT EXISTS channel_rules_brn_idx ON channel_pricing_rules (branch_id);
CREATE INDEX IF NOT EXISTS channel_rules_res_idx ON channel_pricing_rules (reseller_id);

-- 11. RBAC Permissions & Roles Registration for Phase 6
INSERT INTO permissions (key, module, description) VALUES
  ('organization.view',   'organization', 'View ISP organization profiles and metrics'),
  ('organization.edit',   'organization', 'Configure organization details, branding and settings'),
  ('branch.view',         'branch',       'View branch listing, profiles and statistics'),
  ('branch.create',       'branch',       'Create new branch locations'),
  ('branch.edit',         'branch',       'Update branch details and operational statuses'),
  ('branch.delete',       'branch',       'Deactivate or remove branch entities'),
  ('reseller.view',       'reseller',     'View reseller accounts, profiles and commissions'),
  ('reseller.create',     'reseller',     'Onboard new reseller accounts'),
  ('reseller.edit',       'reseller',     'Modify reseller configuration and commission models'),
  ('reseller.delete',     'reseller',     'Suspend or delete reseller accounts'),
  ('wallet.view',         'wallet',       'View wallet balances and ledger transactions'),
  ('wallet.topup',        'wallet',       'Credit/top-up wallet balance (Super Admin only)'),
  ('wallet.debit',        'wallet',       'Debit wallet balance for service transactions'),
  ('wallet.adjust',       'wallet',       'Manual balance adjustments and reconciliation'),
  ('wallet.refund',       'wallet',       'Process wallet refunds'),
  ('credit.view',         'credit',       'View credit limit accounts and credit utilization'),
  ('credit.create',       'credit',       'Grant and configure credit limits'),
  ('credit.edit',         'credit',       'Adjust credit limits and validity dates'),
  ('credit.suspend',      'credit',       'Freeze or revoke credit facilities'),
  ('pricing.view',        'pricing',      'View channel pricing and discount rules'),
  ('pricing.edit',        'pricing',      'Configure branch and reseller pricing overrides'),
  ('pricing.discount',    'pricing',      'Configure channel percentage and fixed discounts'),
  ('pricing.commission',  'pricing',      'Configure reseller commission structures'),
  ('customer.view',       'customer',     'View subscribers assigned to own channel'),
  ('customer.create',     'customer',     'Register new subscribers under channel'),
  ('customer.recharge',   'customer',     'Execute prepaid subscriber recharges via wallet'),
  ('organization.report', 'reports',      'ISP organization aggregated revenue and channel reports'),
  ('branch.report',       'reports',      'Branch-level sales, recharge and subscriber reports'),
  ('reseller.report',     'reports',      'Reseller customer, sales and recharge reports'),
  ('wallet.report',       'reports',      'Financial wallet ledger audit reports'),
  ('commission.report',   'reports',      'Reseller commission ledger and payout reports')
ON CONFLICT (key) DO NOTHING;

-- Register New System Roles if not existing
INSERT INTO roles (name, display_name, description, is_system) VALUES
  ('organization_admin', 'Organization Admin', 'Full access to organization branches, resellers, wallets, and billing', TRUE),
  ('branch_admin',        'Branch Admin',       'Management access restricted to own branch subscribers, staff and wallet', TRUE),
  ('branch_operator',     'Branch Operator',    'Operations access for own branch recharges and subscriber support', TRUE),
  ('reseller_admin',      'Reseller Admin',     'Full management of own reseller customers, wallet, and sub-users', TRUE),
  ('reseller_operator',   'Reseller Operator',  'Can perform recharges for own customers using reseller wallet', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Map permissions to roles
-- Super Admin: gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- Admin: gets organization, branch, reseller, wallet view/adjust, credit, pricing, reports
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name = 'admin'
   AND p.key IN (
     'organization.view', 'organization.edit',
     'branch.view', 'branch.create', 'branch.edit',
     'reseller.view', 'reseller.create', 'reseller.edit',
     'wallet.view', 'wallet.adjust', 'wallet.refund',
     'credit.view', 'credit.create', 'credit.edit', 'credit.suspend',
     'pricing.view', 'pricing.edit', 'pricing.discount', 'pricing.commission',
     'customer.view', 'customer.create', 'customer.recharge',
     'organization.report', 'branch.report', 'reseller.report', 'wallet.report', 'commission.report'
   )
ON CONFLICT DO NOTHING;

-- Organization Admin: full channel operations
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name = 'organization_admin'
   AND p.key IN (
     'organization.view', 'organization.edit',
     'branch.view', 'branch.create', 'branch.edit',
     'reseller.view', 'reseller.create', 'reseller.edit',
     'wallet.view', 'wallet.topup', 'wallet.adjust', 'wallet.refund',
     'credit.view', 'credit.create', 'credit.edit', 'credit.suspend',
     'pricing.view', 'pricing.edit', 'pricing.discount', 'pricing.commission',
     'customer.view', 'customer.create', 'customer.recharge',
     'organization.report', 'branch.report', 'reseller.report', 'wallet.report', 'commission.report'
   )
ON CONFLICT DO NOTHING;

-- Branch Admin: own branch management
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name = 'branch_admin'
   AND p.key IN (
     'branch.view', 'wallet.view', 'credit.view', 'pricing.view',
     'customer.view', 'customer.create', 'customer.recharge',
     'branch.report', 'wallet.report'
   )
ON CONFLICT DO NOTHING;

-- Branch Operator: own branch operations
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name = 'branch_operator'
   AND p.key IN (
     'wallet.view', 'customer.view', 'customer.recharge'
   )
ON CONFLICT DO NOTHING;

-- Reseller Admin: own reseller management
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name = 'reseller_admin'
   AND p.key IN (
     'reseller.view', 'wallet.view', 'credit.view', 'pricing.view',
     'customer.view', 'customer.create', 'customer.recharge',
     'reseller.report', 'wallet.report', 'commission.report'
   )
ON CONFLICT DO NOTHING;

-- Reseller Operator: own reseller recharges
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name = 'reseller_operator'
   AND p.key IN (
     'wallet.view', 'customer.view', 'customer.recharge'
   )
ON CONFLICT DO NOTHING;

-- 12. Seed Demo Branches, Resellers, Wallets, and Pricing Rules for immediate verification
DO $$
DECLARE
  v_org_id INTEGER;
  v_branch_ktm_id INTEGER;
  v_branch_pkr_id INTEGER;
  v_reseller_abc_id INTEGER;
  v_reseller_summit_id INTEGER;
  v_wlt_pkr_id INTEGER;
  v_wlt_abc_id INTEGER;
  v_wlt_summit_id INTEGER;
BEGIN
  SELECT id INTO v_org_id FROM organizations WHERE code = 'SKY-ISP' LIMIT 1;
  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  -- Create Kathmandu Head Branch
  INSERT INTO branches (organization_id, name, code, address, contact_number, email, manager_name, status, notes)
  VALUES (v_org_id, 'Kathmandu Central Branch', 'BRN-KTM', 'New Baneshwor, Kathmandu', '+977-1-4780001', 'ktm.branch@skyradius.net', 'Ramesh Shrestha', 'ACTIVE', 'Primary central hub branch')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_branch_ktm_id;

  -- Create Pokhara Regional Branch
  INSERT INTO branches (organization_id, name, code, address, contact_number, email, manager_name, status, notes)
  VALUES (v_org_id, 'Pokhara Lakeside Branch', 'BRN-PKR', 'Lakeside Ward 6, Pokhara', '+977-61-520111', 'pkr.branch@skyradius.net', 'Sunil Gurung', 'ACTIVE', 'Western regional operational center')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_branch_pkr_id;

  -- Create ABC Net Reseller (Under Pokhara branch)
  INSERT INTO resellers (organization_id, branch_id, name, code, contact_person, phone, email, address, status, commission_model, notes)
  VALUES (v_org_id, v_branch_pkr_id, 'ABC Broadband Reseller', 'RES-ABC', 'Anil Thapa', '+977-9841000001', 'info@abcnet.com.np', 'Prithvi Chowk, Pokhara', 'ACTIVE', 'discount', 'Tier 1 regional distributor')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_reseller_abc_id;

  -- Create Summit Communications Reseller (Directly under ISP)
  INSERT INTO resellers (organization_id, branch_id, name, code, contact_person, phone, email, address, status, commission_model, notes)
  VALUES (v_org_id, NULL, 'Summit Communications', 'RES-SUMMIT', 'Bikash Adhikari', '+977-9851000002', 'contact@summitcomms.np', 'Putalisadak, Kathmandu', 'ACTIVE', 'commission', 'Premier metro reseller partner')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_reseller_summit_id;

  -- Ensure Wallets exist
  -- 1. Pokhara Branch Wallet
  INSERT INTO wallets (wallet_number, entity_type, branch_id, balance, total_topup, total_used, status)
  VALUES ('WLT-BRN-PKR', 'branch', v_branch_pkr_id, 35000.00, 50000.00, 15000.00, 'ACTIVE')
  ON CONFLICT (branch_id) DO UPDATE SET balance = wallets.balance
  RETURNING id INTO v_wlt_pkr_id;

  -- 2. ABC Reseller Wallet
  INSERT INTO wallets (wallet_number, entity_type, reseller_id, balance, total_topup, total_used, status)
  VALUES ('WLT-RES-ABC', 'reseller', v_reseller_abc_id, 25000.00, 40000.00, 15000.00, 'ACTIVE')
  ON CONFLICT (reseller_id) DO UPDATE SET balance = wallets.balance
  RETURNING id INTO v_wlt_abc_id;

  -- 3. Summit Reseller Wallet
  INSERT INTO wallets (wallet_number, entity_type, reseller_id, balance, total_topup, total_used, status)
  VALUES ('WLT-RES-SUMMIT', 'reseller', v_reseller_summit_id, 18500.00, 30000.00, 11500.00, 'ACTIVE')
  ON CONFLICT (reseller_id) DO UPDATE SET balance = wallets.balance
  RETURNING id INTO v_wlt_summit_id;

  -- Ensure Credit Accounts
  IF v_wlt_pkr_id IS NOT NULL THEN
    INSERT INTO credit_accounts (wallet_id, credit_enabled, credit_limit, used_credit, status, notes)
    VALUES (v_wlt_pkr_id, TRUE, 50000.00, 5000.00, 'ACTIVE', 'Branch operational emergency credit line')
    ON CONFLICT (wallet_id) DO NOTHING;
  END IF;

  IF v_wlt_abc_id IS NOT NULL THEN
    INSERT INTO credit_accounts (wallet_id, credit_enabled, credit_limit, used_credit, status, notes)
    VALUES (v_wlt_abc_id, TRUE, 30000.00, 0.00, 'ACTIVE', 'Pre-approved wholesale dealer credit facility')
    ON CONFLICT (wallet_id) DO NOTHING;
  END IF;

  IF v_wlt_summit_id IS NOT NULL THEN
    INSERT INTO credit_accounts (wallet_id, credit_enabled, credit_limit, used_credit, status, notes)
    VALUES (v_wlt_summit_id, FALSE, 0.00, 0.00, 'ACTIVE', 'Standard prepaid tier')
    ON CONFLICT (wallet_id) DO NOTHING;
  END IF;

  -- Initial Wallet Transactions (Ledger demo entries)
  IF v_wlt_abc_id IS NOT NULL THEN
    INSERT INTO wallet_transactions (
      transaction_id, wallet_id, type, amount, balance_before, balance_after,
      credit_used_before, credit_used_after, reference, payment_method, reason, created_by
    ) VALUES (
      'WTX-INIT-ABC-01', v_wlt_abc_id, 'TOP_UP', 40000.00, 0.00, 40000.00,
      0.00, 0.00, 'BANK-DEP-99881', 'BANK_TRANSFER', 'Initial capital topup approved by Super Admin', 'admin'
    ) ON CONFLICT (transaction_id) DO NOTHING;

    INSERT INTO wallet_transactions (
      transaction_id, wallet_id, type, amount, balance_before, balance_after,
      credit_used_before, credit_used_after, reference, payment_method, reason, created_by
    ) VALUES (
      'WTX-DEB-ABC-02', v_wlt_abc_id, 'DEBIT', 15000.00, 40000.00, 25000.00,
      0.00, 0.00, 'REC-BATCH-001', 'ONLINE_PAYMENT', 'Customer batch service activation recharge debit', 'admin'
    ) ON CONFLICT (transaction_id) DO NOTHING;
  END IF;

  -- Default Pricing Rules
  -- Rule 1: All Resellers get 15% discount across all packages
  INSERT INTO channel_pricing_rules (
    rule_name, channel_type, reseller_id, package_id, duration_months,
    rule_type, value, is_active, notes, created_by
  ) VALUES (
    'Standard Reseller 15% Discount', 'reseller', NULL, NULL, NULL,
    'percentage_discount', 15.00, TRUE, 'Default blanket wholesale discount for registered resellers', 'admin'
  ) ON CONFLICT DO NOTHING;

  -- Rule 2: ABC Reseller gets 18% commission on 12-month annual subscriptions
  INSERT INTO channel_pricing_rules (
    rule_name, channel_type, reseller_id, package_id, duration_months,
    rule_type, value, is_active, notes, created_by
  ) VALUES (
    'ABC Reseller Annual Incentive (18%)', 'reseller', v_reseller_abc_id, NULL, 12,
    'percentage_discount', 18.00, TRUE, 'Special incentive tier for annual contracts', 'admin'
  ) ON CONFLICT DO NOTHING;

  -- Rule 3: Pokhara Branch 10% operational margin
  INSERT INTO channel_pricing_rules (
    rule_name, channel_type, branch_id, package_id, duration_months,
    rule_type, value, is_active, notes, created_by
  ) VALUES (
    'Pokhara Regional Branch Margin (10%)', 'branch', v_branch_pkr_id, NULL, NULL,
    'percentage_discount', 10.00, TRUE, 'Branch accounting internal transfer pricing', 'admin'
  ) ON CONFLICT DO NOTHING;

  -- Map some existing subscribers to demo branch & reseller
  UPDATE subscribers
     SET branch_id = v_branch_pkr_id,
         reseller_id = v_reseller_abc_id,
         ownership_type = 'reseller'
   WHERE id IN (SELECT id FROM subscribers ORDER BY id ASC LIMIT 3);

  UPDATE subscribers
     SET branch_id = v_branch_pkr_id,
         reseller_id = NULL,
         ownership_type = 'branch'
   WHERE id IN (SELECT id FROM subscribers WHERE reseller_id IS NULL ORDER BY id ASC LIMIT 3);

END $$;
