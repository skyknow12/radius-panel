-- =============================================================================
-- Migration 011: Fix Reseller Hierarchy, Unified Balance Ledger & RBAC Permissions
-- =============================================================================

-- 1. Ensure branch_id is nullable in resellers (Resellers belong to Organization, NOT Branch)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'resellers' AND column_name = 'branch_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE resellers ALTER COLUMN branch_id DROP NOT NULL;
  END IF;
END $$;

-- 2. Ensure commission_percent and credit columns exist on resellers
ALTER TABLE resellers
  ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5,2) NOT NULL DEFAULT 50.00 CHECK (commission_percent >= 0 AND commission_percent < 100),
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12,2) NOT NULL DEFAULT 50000.00 CHECK (credit_limit >= 0),
  ADD COLUMN IF NOT EXISTS credit_used NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (credit_used >= 0),
  ADD COLUMN IF NOT EXISTS credit_status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK (credit_status IN ('ACTIVE', 'SUSPENDED', 'EXPIRED'));

-- 3. Ensure Wallets exist for all resellers
INSERT INTO wallets (wallet_number, entity_type, reseller_id, balance, total_topup, total_used, status)
SELECT 'WLT-RES-' || UPPER(r.code), 'reseller', r.id, 0.00, 0.00, 0.00, 'ACTIVE'
  FROM resellers r
 WHERE NOT EXISTS (SELECT 1 FROM wallets w WHERE w.reseller_id = r.id)
ON CONFLICT DO NOTHING;

-- 4. Ensure Credit Accounts exist for all reseller wallets
INSERT INTO credit_accounts (wallet_id, credit_enabled, credit_limit, used_credit, status)
SELECT w.id, TRUE, COALESCE(r.credit_limit, 50000.00), COALESCE(r.credit_used, 0.00), 'ACTIVE'
  FROM wallets w
  JOIN resellers r ON r.id = w.reseller_id
 WHERE NOT EXISTS (SELECT 1 FROM credit_accounts ca WHERE ca.wallet_id = w.id)
ON CONFLICT DO NOTHING;

-- 5. Ensure Reseller Commission History table exists
CREATE TABLE IF NOT EXISTS reseller_commission_history (
  id                SERIAL PRIMARY KEY,
  reseller_id       INTEGER NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
  previous_percent  NUMERIC(5,2) NOT NULL,
  new_percent       NUMERIC(5,2) NOT NULL,
  changed_by        VARCHAR(64) NOT NULL,
  reason            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reseller_comm_hist_res_idx ON reseller_commission_history (reseller_id);
CREATE INDEX IF NOT EXISTS reseller_comm_hist_date_idx ON reseller_commission_history (created_at);

-- 6. Ensure Reseller Wallet Transactions table exists
CREATE TABLE IF NOT EXISTS reseller_wallet_transactions (
  id                  SERIAL PRIMARY KEY,
  transaction_id      VARCHAR(64) NOT NULL UNIQUE,
  reseller_id         INTEGER NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
  wallet_id           INTEGER NULL REFERENCES wallets(id) ON DELETE SET NULL,
  type                VARCHAR(32) NOT NULL CHECK (type IN (
                        'RESELLER_TOPUP_CASH',
                        'RESELLER_TOPUP_CREDIT',
                        'RESELLER_CUSTOMER_RECHARGE',
                        'RESELLER_WALLET_ADJUSTMENT',
                        'RESELLER_WALLET_REFUND',
                        'RESELLER_TOPUP_REVERSAL',
                        'RESELLER_CREDIT_ADJUSTMENT'
                      )),
  status              VARCHAR(16) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN (
                        'PENDING',
                        'COMPLETED',
                        'CANCELLED',
                        'REFUNDED',
                        'REVERSED',
                        'FAILED'
                      )),
  cash_amount         NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (cash_amount >= 0),
  credit_amount       NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (credit_amount >= 0),
  commission_percent  NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (commission_percent >= 0 AND commission_percent < 100),
  commission_amount   NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (commission_amount >= 0),
  wallet_value        NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (wallet_value >= 0),
  wallet_debit        NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (wallet_debit >= 0),
  balance_before      NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  balance_after       NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  credit_used_before  NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  credit_used_after   NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  customer_id         INTEGER NULL REFERENCES subscribers(id) ON DELETE SET NULL,
  customer_username   VARCHAR(64) NULL,
  package_id          INTEGER NULL REFERENCES packages(id) ON DELETE SET NULL,
  package_name        VARCHAR(128) NULL,
  duration_months     INTEGER NULL DEFAULT 1,
  payment_method      VARCHAR(32) NULL,
  reference           VARCHAR(128) NULL,
  remarks             TEXT NULL,
  reversal_of_id      VARCHAR(64) NULL,
  refund_of_id        VARCHAR(64) NULL,
  idempotency_key     VARCHAR(128) UNIQUE,
  created_by          VARCHAR(64) NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS res_wlt_tx_reseller_idx ON reseller_wallet_transactions (reseller_id);
CREATE INDEX IF NOT EXISTS res_wlt_tx_type_idx ON reseller_wallet_transactions (type);
CREATE INDEX IF NOT EXISTS res_wlt_tx_date_idx ON reseller_wallet_transactions (created_at);

-- 7. Ensure All RBAC Permissions for Branch, Reseller, Wallet, and Credit are Registered
INSERT INTO permissions (key, module, description) VALUES
  ('branch.view',                  'branch',       'View branch listing and profiles'),
  ('branch.create',                'branch',       'Create new branch locations'),
  ('branch.edit',                  'branch',       'Modify branch details'),
  ('branch.delete',                'branch',       'Delete or deactivate branches'),
  ('reseller.view',                'reseller',     'View reseller listing and profiles'),
  ('reseller.create',              'reseller',     'Create new reseller accounts'),
  ('reseller.edit',                'reseller',     'Modify reseller configuration and commission'),
  ('reseller.suspend',             'reseller',     'Suspend or reactivate resellers'),
  ('reseller.delete',              'reseller',     'Delete or deactivate resellers'),
  ('reseller.wallet.view',         'reseller',     'View reseller balance and ledger'),
  ('reseller.wallet.topup',        'reseller',     'Perform cash and credit top-up on reseller balance'),
  ('reseller.wallet.adjust',       'reseller',     'Adjust reseller balance'),
  ('reseller.wallet.refund',       'reseller',     'Process refund on reseller balance'),
  ('reseller.credit.view',         'reseller',     'View reseller credit facility'),
  ('reseller.credit.create',       'reseller',     'Grant credit top-ups to resellers'),
  ('reseller.credit.adjust',       'reseller',     'Adjust reseller credit limits and terms'),
  ('reseller.credit.suspend',      'reseller',     'Freeze or suspend reseller credit'),
  ('reseller.credit.override',     'reseller',     'Override credit limit during top-up'),
  ('reseller.pricing.view',        'reseller',     'View reseller pricing and packages'),
  ('reseller.pricing.edit',        'reseller',     'Edit reseller pricing'),
  ('reseller.pricing.commission',  'reseller',     'Manage reseller commission structures'),
  ('reseller.transactions.view',   'reseller',     'View reseller transactions ledger'),
  ('reseller.transactions.export', 'reseller',     'Export reseller transactions to CSV/Excel'),
  ('reseller.reports.view',        'reseller',     'View reseller analytical reports'),
  ('reseller.reports.export',      'reseller',     'Export reseller analytical reports'),
  ('wallet.view',                  'wallet',       'View wallet balances'),
  ('wallet.topup',                 'wallet',       'Credit/top-up wallet balance'),
  ('wallet.adjust',                'wallet',       'Adjust wallet balances'),
  ('wallet.refund',                'wallet',       'Refund wallet transactions'),
  ('credit.view',                  'credit',       'View credit accounts'),
  ('credit.create',                'credit',       'Grant credit limits'),
  ('credit.edit',                  'credit',       'Modify credit accounts'),
  ('credit.suspend',               'credit',       'Suspend credit accounts')
ON CONFLICT (key) DO NOTHING;

-- 8. Grant All Permissions to super_admin, admin, and organization_admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name IN ('super_admin', 'admin', 'organization_admin')
   AND p.key IN (
     'branch.view', 'branch.create', 'branch.edit', 'branch.delete',
     'reseller.view', 'reseller.create', 'reseller.edit', 'reseller.suspend', 'reseller.delete',
     'reseller.wallet.view', 'reseller.wallet.topup', 'reseller.wallet.adjust', 'reseller.wallet.refund',
     'reseller.credit.view', 'reseller.credit.create', 'reseller.credit.adjust', 'reseller.credit.suspend', 'reseller.credit.override',
     'reseller.pricing.view', 'reseller.pricing.edit', 'reseller.pricing.commission',
     'reseller.transactions.view', 'reseller.transactions.export',
     'reseller.reports.view', 'reseller.reports.export',
     'wallet.view', 'wallet.topup', 'wallet.adjust', 'wallet.refund',
     'credit.view', 'credit.create', 'credit.edit', 'credit.suspend'
   )
ON CONFLICT DO NOTHING;
