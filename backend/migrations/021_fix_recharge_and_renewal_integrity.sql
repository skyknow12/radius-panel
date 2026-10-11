-- =============================================================================
-- Migration 021: Fix Customer Recharge, Renewal & Financial Integrity
-- =============================================================================

-- 1. Ensure recharge_transactions columns duration_months and amount have defaults
ALTER TABLE recharge_transactions
  ALTER COLUMN duration_months SET DEFAULT 1,
  ALTER COLUMN amount SET DEFAULT 0;

-- 2. Ensure indexes on recharge_transactions for idempotency and performance
CREATE INDEX IF NOT EXISTS idx_recharge_tx_idempotency ON recharge_transactions (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_recharge_tx_subscriber_date ON recharge_transactions (subscriber_id, recharge_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_txid ON invoices (transaction_id);

-- 3. Ensure subscriber_services service_id column is indexed
CREATE INDEX IF NOT EXISTS idx_subscriber_services_service_id ON subscriber_services (service_id);
