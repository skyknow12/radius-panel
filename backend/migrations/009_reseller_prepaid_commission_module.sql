-- =============================================================================
-- Migration 009: Complete Reseller Management Module
-- Prepaid Commission + Cash Top-Up + Credit Top-Up + Wallet + Customer Recharge
-- =============================================================================

-- 1. Extend resellers table
ALTER TABLE resellers
  ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5,2) NOT NULL DEFAULT 50.00 CHECK (commission_percent >= 0 AND commission_percent < 100),
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (credit_limit >= 0),
  ADD COLUMN IF NOT EXISTS credit_used NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (credit_used >= 0),
  ADD COLUMN IF NOT EXISTS credit_status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK (credit_status IN ('ACTIVE', 'SUSPENDED', 'EXPIRED'));

CREATE INDEX IF NOT EXISTS resellers_comm_idx ON resellers (commission_percent);
CREATE INDEX IF NOT EXISTS resellers_cred_status_idx ON resellers (credit_status);

-- Ensure wallets exist for all resellers
INSERT INTO wallets (wallet_number, entity_type, reseller_id, balance, total_topup, total_used, status)
SELECT 'WLT-RES-' || UPPER(r.code), 'reseller', r.id, 0.00, 0.00, 0.00, 'ACTIVE'
  FROM resellers r
 WHERE NOT EXISTS (SELECT 1 FROM wallets w WHERE w.reseller_id = r.id)
ON CONFLICT DO NOTHING;

-- Ensure credit_accounts exist for all reseller wallets
INSERT INTO credit_accounts (wallet_id, credit_enabled, credit_limit, used_credit, status)
SELECT w.id, TRUE, COALESCE(r.credit_limit, 50000.00), COALESCE(r.credit_used, 0.00), 'ACTIVE'
  FROM wallets w
  JOIN resellers r ON r.id = w.reseller_id
 WHERE NOT EXISTS (SELECT 1 FROM credit_accounts ca WHERE ca.wallet_id = w.id)
ON CONFLICT DO NOTHING;

-- Sync reseller credit_limit with credit_accounts if any
UPDATE resellers r
   SET credit_limit = COALESCE(ca.credit_limit, r.credit_limit),
       credit_used = COALESCE(ca.used_credit, r.credit_used)
  FROM wallets w
  JOIN credit_accounts ca ON ca.wallet_id = w.id
 WHERE w.reseller_id = r.id;

-- 2. Reseller Commission History Table
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

-- 3. Reseller Wallet Transactions Table (Dedicated Immutable Financial Ledger)
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
CREATE INDEX IF NOT EXISTS res_wlt_tx_status_idx ON reseller_wallet_transactions (status);
CREATE INDEX IF NOT EXISTS res_wlt_tx_cust_idx ON reseller_wallet_transactions (customer_id);
CREATE INDEX IF NOT EXISTS res_wlt_tx_date_idx ON reseller_wallet_transactions (created_at);
CREATE INDEX IF NOT EXISTS res_wlt_tx_idem_idx ON reseller_wallet_transactions (idempotency_key);

-- 4. RBAC Permissions Registration
INSERT INTO permissions (key, module, description) VALUES
  ('reseller.wallet.topup',    'reseller', 'Perform Cash and Credit top-up on reseller wallets'),
  ('reseller.wallet.adjust',   'reseller', 'Perform balance adjustment on reseller wallets'),
  ('reseller.wallet.refund',   'reseller', 'Process refunds for reseller transactions'),
  ('reseller.wallet.reverse',  'reseller', 'Reverse prior top-up transactions with ledger records'),
  ('reseller.credit.create',   'reseller', 'Grant credit top-ups to resellers'),
  ('reseller.credit.edit',     'reseller', 'Modify reseller credit limits and terms'),
  ('reseller.credit.override', 'reseller', 'Authorise credit exceeding the approved credit limit')
ON CONFLICT (key) DO NOTHING;

-- Grant permissions to admin and super_admin roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name IN ('admin', 'super_admin', 'organization_admin')
   AND p.key IN (
     'reseller.wallet.topup',
     'reseller.wallet.adjust',
     'reseller.wallet.refund',
     'reseller.wallet.reverse',
     'reseller.credit.create',
     'reseller.credit.edit',
     'reseller.credit.override'
   )
ON CONFLICT DO NOTHING;
