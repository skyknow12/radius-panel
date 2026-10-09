-- =============================================================================
-- Migration 012: Reseller Credit Repayment, User Link & Extended RBAC
-- =============================================================================

-- 1. Ensure user_id column exists on resellers for direct login account association
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'resellers' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE resellers ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Upgrade reseller_wallet_transactions CHECK constraint to support RESELLER_CREDIT_REPAYMENT
DO $$
BEGIN
  ALTER TABLE reseller_wallet_transactions DROP CONSTRAINT IF EXISTS reseller_wallet_transactions_type_check;
  ALTER TABLE reseller_wallet_transactions ADD CONSTRAINT reseller_wallet_transactions_type_check
    CHECK (type IN (
      'RESELLER_TOPUP_CASH',
      'RESELLER_TOPUP_CREDIT',
      'RESELLER_CUSTOMER_RECHARGE',
      'RESELLER_WALLET_ADJUSTMENT',
      'RESELLER_WALLET_REFUND',
      'RESELLER_TOPUP_REVERSAL',
      'RESELLER_CREDIT_ADJUSTMENT',
      'RESELLER_CREDIT_REPAYMENT'
    ));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 3. Register Credit Repayment Permission
INSERT INTO permissions (key, module, description) VALUES
  ('reseller.credit.repay', 'reseller', 'Process reseller credit repayment/settlement')
ON CONFLICT (key) DO NOTHING;

-- 4. Grant Permissions to administrative roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name IN ('super_admin', 'admin', 'organization_admin')
   AND p.key IN ('reseller.credit.repay')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 5. Ensure reseller_admin role has necessary self-service permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name = 'reseller_admin'
   AND p.key IN (
     'reseller.view',
     'reseller.wallet.view',
     'reseller.credit.view',
     'reseller.transactions.view',
     'reseller.transactions.export',
     'reseller.reports.view',
     'reseller.reports.export',
     'wallet.view',
     'credit.view',
     'customer.view',
     'customer.create',
     'customer.recharge'
   )
ON CONFLICT (role_id, permission_id) DO NOTHING;
