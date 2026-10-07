-- =============================================================================
-- Migration 006: Phase 5 — Core Billing, Recharge & Financial Management
-- =============================================================================

-- 1. Upgrade recharge_transactions to support full financial auditing & snapshots
ALTER TABLE recharge_transactions
  ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(64) UNIQUE,
  ADD COLUMN IF NOT EXISTS customer_id VARCHAR(32),
  ADD COLUMN IF NOT EXISTS username VARCHAR(64),
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(128),
  ADD COLUMN IF NOT EXISTS package_name VARCHAR(64),
  ADD COLUMN IF NOT EXISTS duration INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS duration_unit VARCHAR(16) NOT NULL DEFAULT 'months',
  ADD COLUMN IF NOT EXISTS original_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type VARCHAR(16) NOT NULL DEFAULT 'none', -- 'none', 'fixed', 'percentage'
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjustment_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(128),
  ADD COLUMN IF NOT EXISTS status VARCHAR(24) NOT NULL DEFAULT 'COMPLETED', -- 'PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'FAILED'
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128) UNIQUE,
  ADD COLUMN IF NOT EXISTS organization_id INTEGER NULL,
  ADD COLUMN IF NOT EXISTS branch_id INTEGER NULL,
  ADD COLUMN IF NOT EXISTS reseller_id INTEGER NULL,
  ADD COLUMN IF NOT EXISTS wallet_id INTEGER NULL,
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Backfill transaction_id & snapshots for any existing recharge rows
UPDATE recharge_transactions rt
   SET transaction_id = COALESCE(rt.transaction_id, rt.receipt_no),
       original_price = CASE WHEN rt.original_price = 0 THEN rt.amount ELSE rt.original_price END,
       final_amount   = CASE WHEN rt.final_amount = 0 THEN rt.amount ELSE rt.final_amount END,
       duration       = COALESCE(rt.duration_months, 1)
 WHERE rt.transaction_id IS NULL OR rt.final_amount = 0;

-- Backfill subscriber & package snapshot details where missing
UPDATE recharge_transactions rt
   SET username    = s.username,
       customer_id = s.customer_id,
       full_name   = s.full_name,
       package_name = p.name
  FROM subscribers s, packages p
 WHERE rt.subscriber_id = s.id AND rt.package_id = p.id
   AND (rt.username IS NULL OR rt.package_name IS NULL);

CREATE INDEX IF NOT EXISTS recharge_transactions_txid_idx ON recharge_transactions (transaction_id);
CREATE INDEX IF NOT EXISTS recharge_transactions_status_idx ON recharge_transactions (status);
CREATE INDEX IF NOT EXISTS recharge_transactions_paymethod_idx ON recharge_transactions (payment_method);
CREATE INDEX IF NOT EXISTS recharge_transactions_uname_idx ON recharge_transactions (lower(username));

-- 2. Package Price History Table
CREATE TABLE IF NOT EXISTS package_price_history (
  id               SERIAL PRIMARY KEY,
  package_id       INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  duration_months  INTEGER NOT NULL,
  old_price        NUMERIC(10,2),
  new_price        NUMERIC(10,2) NOT NULL,
  currency         VARCHAR(8) NOT NULL DEFAULT 'NPR',
  changed_by       VARCHAR(64) NOT NULL DEFAULT 'admin',
  reason           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS package_price_hist_pkg_idx ON package_price_history (package_id);
CREATE INDEX IF NOT EXISTS package_price_hist_date_idx ON package_price_history (created_at);

-- 3. Payment Methods Table
CREATE TABLE IF NOT EXISTS payment_methods (
  id                  SERIAL PRIMARY KEY,
  code                VARCHAR(32) NOT NULL UNIQUE,
  name                VARCHAR(64) NOT NULL,
  requires_reference  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  description         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO payment_methods (code, name, requires_reference, is_active, sort_order, description) VALUES
  ('CASH',           'Cash',                   FALSE, TRUE, 1, 'Physical cash payment at counter or NOC'),
  ('BANK_TRANSFER',  'Bank Transfer',          TRUE,  TRUE, 2, 'Direct bank wire or mobile deposit (voucher/slip req.)'),
  ('QR',             'Fonepay / QR Payment',   TRUE,  TRUE, 3, 'Instant QR code scan (Txn ref req.)'),
  ('ONLINE_PAYMENT', 'Digital Wallet',         TRUE,  TRUE, 4, 'eSewa / Khalti / IME Pay mobile wallet'),
  ('CHEQUE',         'Bank Cheque',            TRUE,  TRUE, 5, 'Bank cheque / draft deposit'),
  ('COMPLIMENTARY',  'Staff / Complimentary',  FALSE, TRUE, 6, 'Internal company/staff complimentary service')
ON CONFLICT (code) DO NOTHING;

-- 4. Refunds Table
CREATE TABLE IF NOT EXISTS refunds (
  id               SERIAL PRIMARY KEY,
  refund_id        VARCHAR(32) NOT NULL UNIQUE,
  transaction_id   VARCHAR(64) NOT NULL REFERENCES recharge_transactions(transaction_id) ON DELETE RESTRICT,
  subscriber_id    INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  amount           NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  currency         VARCHAR(8) NOT NULL DEFAULT 'NPR',
  refund_type      VARCHAR(16) NOT NULL DEFAULT 'full', -- 'full', 'partial'
  reason           TEXT NOT NULL,
  refund_method    VARCHAR(32) NOT NULL DEFAULT 'Cash',
  processed_by     VARCHAR(64) NOT NULL DEFAULT 'admin',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS refunds_txid_idx ON refunds (transaction_id);
CREATE INDEX IF NOT EXISTS refunds_sub_idx ON refunds (subscriber_id);
CREATE INDEX IF NOT EXISTS refunds_date_idx ON refunds (created_at);

-- 5. Billing Manual Adjustments Table
CREATE TABLE IF NOT EXISTS billing_adjustments (
  id                 SERIAL PRIMARY KEY,
  adjustment_id      VARCHAR(32) NOT NULL UNIQUE,
  subscriber_id      INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  adjustment_type    VARCHAR(24) NOT NULL, -- 'amount', 'expiry', 'credit', 'discount'
  amount             NUMERIC(10,2) DEFAULT 0,
  days               INTEGER DEFAULT 0,
  reason             TEXT NOT NULL,
  operator_username  VARCHAR(64) NOT NULL DEFAULT 'admin',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS billing_adj_sub_idx ON billing_adjustments (subscriber_id);
CREATE INDEX IF NOT EXISTS billing_adj_date_idx ON billing_adjustments (created_at);

-- 6. Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  id               SERIAL PRIMARY KEY,
  invoice_no       VARCHAR(32) NOT NULL UNIQUE,
  transaction_id   VARCHAR(64) REFERENCES recharge_transactions(transaction_id) ON DELETE SET NULL,
  subscriber_id    INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  customer_name    VARCHAR(128) NOT NULL,
  customer_id      VARCHAR(32) NOT NULL,
  username         VARCHAR(64) NOT NULL,
  service_name     VARCHAR(64) NOT NULL DEFAULT 'Broadband Internet',
  package_name     VARCHAR(64) NOT NULL,
  duration_months  INTEGER NOT NULL DEFAULT 1,
  price            NUMERIC(10,2) NOT NULL,
  discount_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_rate         NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount     NUMERIC(10,2) NOT NULL,
  currency         VARCHAR(8) NOT NULL DEFAULT 'NPR',
  status           VARCHAR(16) NOT NULL DEFAULT 'PAID', -- 'PAID', 'UNPAID', 'CANCELLED'
  issue_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date         TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invoices_txid_idx ON invoices (transaction_id);
CREATE INDEX IF NOT EXISTS invoices_sub_idx ON invoices (subscriber_id);
CREATE INDEX IF NOT EXISTS invoices_uname_idx ON invoices (lower(username));
CREATE INDEX IF NOT EXISTS invoices_date_idx ON invoices (issue_date);

-- 7. Register Billing RBAC Permissions
INSERT INTO permissions (key, module, description) VALUES
  ('billing.view',          'billing', 'View billing dashboard, transactions, and invoices'),
  ('billing.recharge',      'billing', 'Perform subscriber recharges'),
  ('billing.discount',      'billing', 'Apply financial discounts during recharge'),
  ('billing.adjustment',    'billing', 'Perform manual account or expiry adjustments'),
  ('billing.refund',        'billing', 'Process full or partial transaction refunds'),
  ('billing.invoice',       'billing', 'Generate, view and download customer invoices'),
  ('billing.receipt',       'billing', 'Generate, view and print payment receipts'),
  ('billing.report',        'billing', 'Access financial revenue and transaction reports'),
  ('billing.export',        'billing', 'Export billing and transaction data to CSV'),
  ('billing.package_price', 'billing', 'Configure and update package multi-duration pricing')
ON CONFLICT (key) DO NOTHING;

-- Grant all billing permissions to super_admin and admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r
 CROSS JOIN permissions p
 WHERE r.name IN ('super_admin', 'admin')
   AND p.module = 'billing'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant operational billing permissions to operator
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r
  JOIN permissions p ON p.key IN (
    'billing.view',
    'billing.recharge',
    'billing.discount',
    'billing.invoice',
    'billing.receipt',
    'billing.report'
  )
 WHERE r.name = 'operator'
ON CONFLICT (role_id, permission_id) DO NOTHING;
