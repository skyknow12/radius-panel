import { query, getClient } from '../db/pool';
import { HttpError } from '../lib/http-error';
import { auditRepository } from './audit.repository';

export interface ResellerTopupCalcResult {
  paymentAmount: number;
  commissionPercent: number;
  walletValue: number;
  commissionAmount: number;
  cashAmount: number;
  creditAmount: number;
  type: 'CASH' | 'CREDIT';
}

export interface ResellerTopupInput {
  resellerId: number;
  type: 'CASH' | 'CREDIT';
  amount: number;
  commissionPercent?: number;
  paymentMethod?: string;
  reference?: string;
  remarks?: string;
  idempotencyKey?: string;
  operator: string;
  allowCreditOverride?: boolean;
}

export interface ResellerCustomerRechargeInput {
  resellerId: number;
  subscriberId: number;
  packageId: number;
  durationMonths?: number;
  operator: string;
  remarks?: string;
}

export interface ResellerWalletTxRow {
  id: number;
  transaction_id: string;
  reseller_id: number;
  reseller_name?: string;
  reseller_code?: string;
  wallet_id: number | null;
  type: string;
  status: string;
  cash_amount: number;
  credit_amount: number;
  commission_percent: number;
  commission_amount: number;
  wallet_value: number;
  wallet_debit: number;
  balance_before: number;
  balance_after: number;
  credit_used_before: number;
  credit_used_after: number;
  customer_id: number | null;
  customer_username: string | null;
  package_id: number | null;
  package_name: string | null;
  duration_months: number;
  payment_method: string | null;
  reference: string | null;
  remarks: string | null;
  reversal_of_id: string | null;
  refund_of_id: string | null;
  idempotency_key: string | null;
  created_by: string;
  created_at: string;
}

export interface ResellerTxFilter {
  reseller_id?: number;
  type?: string;
  status?: string;
  payment_method?: string;
  customer_id?: number;
  search?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface ResellerReportFilter {
  reseller_id?: number;
  period?: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_year' | 'custom' | 'all_time';
  start_date?: string;
  end_date?: string;
  type?: string;
  status?: string;
  payment_method?: string;
}

export class ResellerRepository {
  /**
   * Pure mathematical formula for prepaid commission top-up
   * Wallet Value = Cash or Credit Payment / (1 - Commission %)
   * Commission Value = Wallet Value - Payment
   */
  calculateTopup(paymentAmount: number, commissionPercent: number, type: 'CASH' | 'CREDIT'): ResellerTopupCalcResult {
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      throw HttpError.badRequest('Payment amount must be greater than 0');
    }
    if (isNaN(commissionPercent) || commissionPercent < 0 || commissionPercent >= 100) {
      throw HttpError.badRequest('Commission percentage must be between 0% and 99.99%');
    }

    const commRate = commissionPercent / 100;
    let walletValue: number;
    let commissionAmount: number;

    if (commRate === 0) {
      walletValue = Math.round(paymentAmount * 100) / 100;
      commissionAmount = 0.00;
    } else {
      // Wallet Value = Payment / (1 - Commission %)
      walletValue = Math.round((paymentAmount / (1 - commRate)) * 100) / 100;
      commissionAmount = Math.round((walletValue - paymentAmount) * 100) / 100;
    }

    const cashAmount = type === 'CASH' ? paymentAmount : 0.00;
    const creditAmount = type === 'CREDIT' ? paymentAmount : 0.00;

    return {
      paymentAmount,
      commissionPercent,
      walletValue,
      commissionAmount,
      cashAmount,
      creditAmount,
      type,
    };
  }

  /**
   * Perform atomic Cash or Credit Top-Up on reseller wallet with prepaid commission
   */
  async topupReseller(input: ResellerTopupInput): Promise<ResellerWalletTxRow> {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // 1. Idempotency check
      if (input.idempotencyKey) {
        const existingTx = await client.query<ResellerWalletTxRow>(
          `SELECT * FROM reseller_wallet_transactions WHERE idempotency_key = $1`,
          [input.idempotencyKey]
        );
        if (existingTx.rows.length > 0) {
          await client.query('COMMIT');
          return existingTx.rows[0];
        }
      }

      // 2. Lock Reseller record
      const resResult = await client.query<{
        id: number;
        name: string;
        code: string;
        status: string;
        commission_percent: string;
        credit_limit: string;
        credit_used: string;
        credit_status: string;
      }>(`
        SELECT id, name, code, status, commission_percent, credit_limit, credit_used, credit_status
          FROM resellers
         WHERE id = $1
         FOR UPDATE
      `, [input.resellerId]);

      if (resResult.rows.length === 0) {
        throw HttpError.notFound('Reseller not found');
      }
      const reseller = resResult.rows[0];

      if (reseller.status !== 'ACTIVE') {
        throw HttpError.badRequest(`Cannot top-up inactive reseller (${reseller.status})`);
      }

      // 3. Lock Wallet record
      let wltResult = await client.query<{
        id: number;
        balance: string;
        total_topup: string;
        total_used: string;
        status: string;
      }>(`
        SELECT id, balance, total_topup, total_used, status
          FROM wallets
         WHERE reseller_id = $1
         FOR UPDATE
      `, [input.resellerId]);

      if (wltResult.rows.length === 0) {
        // Auto-create wallet if missing
        const wltNum = `WLT-RES-${reseller.code.toUpperCase()}`;
        const createdWlt = await client.query<{ id: number; balance: string; total_topup: string; total_used: string; status: string }>(`
          INSERT INTO wallets (wallet_number, entity_type, reseller_id, balance, total_topup, total_used, status)
          VALUES ($1, 'reseller', $2, 0.00, 0.00, 0.00, 'ACTIVE')
          RETURNING id, balance, total_topup, total_used, status
        `, [wltNum, reseller.id]);
        wltResult = createdWlt;
      }
      const wallet = wltResult.rows[0];

      if (wallet.status !== 'ACTIVE') {
        throw HttpError.badRequest(`Reseller wallet is locked or suspended (${wallet.status})`);
      }

      // 4. Commission determination
      const commissionPercent = input.commissionPercent !== undefined
        ? Number(input.commissionPercent)
        : Number(reseller.commission_percent || 50.00);

      // 5. Calculate financial values
      const calc = this.calculateTopup(input.amount, commissionPercent, input.type);

      const balanceBefore = Number(wallet.balance || 0);
      const creditLimit = Number(reseller.credit_limit || 0);
      const creditUsedBefore = Number(reseller.credit_used || 0);

      // 6. Credit Top-Up validations
      let creditUsedAfter = creditUsedBefore;
      if (input.type === 'CREDIT') {
        if (reseller.credit_status !== 'ACTIVE') {
          throw HttpError.badRequest(`Reseller credit facility is suspended (${reseller.credit_status})`);
        }
        const remainingCredit = Math.max(0, creditLimit - creditUsedBefore);
        if (input.amount > remainingCredit && !input.allowCreditOverride) {
          throw HttpError.badRequest(
            `Credit limit exceeded. Credit remaining: Rs. ${remainingCredit.toFixed(2)}, requested: Rs. ${input.amount.toFixed(2)}. Admin credit override required.`
          );
        }
        creditUsedAfter = creditUsedBefore + input.amount;
      }

      const balanceAfter = balanceBefore + calc.walletValue;
      const totalTopupAfter = Number(wallet.total_topup || 0) + calc.walletValue;

      // 7. Update Wallet
      await client.query(`
        UPDATE wallets
           SET balance = $1,
               total_topup = $2,
               updated_at = NOW()
         WHERE id = $3
      `, [balanceAfter, totalTopupAfter, wallet.id]);

      // 8. Update Reseller credit usage if CREDIT
      if (input.type === 'CREDIT') {
        await client.query(`
          UPDATE resellers
             SET credit_used = $1,
                 updated_at = NOW()
           WHERE id = $2
        `, [creditUsedAfter, reseller.id]);

        // Keep credit_accounts synced
        await client.query(`
          UPDATE credit_accounts
             SET used_credit = $1,
                 updated_at = NOW()
           WHERE wallet_id = $2
        `, [creditUsedAfter, wallet.id]);
      }

      // 9. Generate Transaction ID
      const txId = `TXN-RES-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const txType = input.type === 'CASH' ? 'RESELLER_TOPUP_CASH' : 'RESELLER_TOPUP_CREDIT';
      const paymentMethod = input.paymentMethod || (input.type === 'CASH' ? 'Cash' : 'Credit Facility');

      // 10. Insert dedicated ledger transaction
      const { rows } = await client.query<ResellerWalletTxRow>(`
        INSERT INTO reseller_wallet_transactions (
          transaction_id, reseller_id, wallet_id, type, status,
          cash_amount, credit_amount, commission_percent, commission_amount,
          wallet_value, wallet_debit, balance_before, balance_after,
          credit_used_before, credit_used_after, payment_method, reference,
          remarks, idempotency_key, created_by
        ) VALUES (
          $1, $2, $3, $4, 'COMPLETED',
          $5, $6, $7, $8,
          $9, 0.00, $10, $11,
          $12, $13, $14, $15,
          $16, $17, $18
        )
        RETURNING *
      `, [
        txId,
        reseller.id,
        wallet.id,
        txType,
        calc.cashAmount,
        calc.creditAmount,
        calc.commissionPercent,
        calc.commissionAmount,
        calc.walletValue,
        balanceBefore,
        balanceAfter,
        creditUsedBefore,
        creditUsedAfter,
        paymentMethod,
        input.reference || null,
        input.remarks || null,
        input.idempotencyKey || null,
        input.operator,
      ]);

      // 11. Mirror to wallet_transactions for Phase 6 view backwards compatibility
      await client.query(`
        INSERT INTO wallet_transactions (
          transaction_id, wallet_id, type, amount, balance_before, balance_after,
          credit_used_before, credit_used_after, reference, payment_method, reason, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )
        ON CONFLICT (transaction_id) DO NOTHING
      `, [
        txId,
        wallet.id,
        'TOP_UP',
        calc.walletValue,
        balanceBefore,
        balanceAfter,
        creditUsedBefore,
        creditUsedAfter,
        input.reference || null,
        paymentMethod,
        `${txType}: Payment Rs. ${input.amount} (Comm ${commissionPercent}%) -> Added Rs. ${calc.walletValue}`,
        input.operator,
      ]);

      await client.query('COMMIT');

      // Audit log
      await auditRepository.insert({
        username: input.operator,
        action: txType,
        entityType: 'reseller_wallet',
        entityId: String(reseller.id),
        status: 'success',
        metadata: {
          transaction_id: txId,
          type: input.type,
          payment: input.amount,
          commission_percent: commissionPercent,
          commission_amount: calc.commissionAmount,
          wallet_value: calc.walletValue,
          balance_after: balanceAfter,
        },
      }).catch(() => undefined);

      return rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Recharge customer package from Reseller Wallet
   * Debits normal customer package price from reseller wallet with ZERO secondary commission
   */
  async customerRecharge(input: ResellerCustomerRechargeInput): Promise<ResellerWalletTxRow> {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // 1. Fetch Package
      const pkgRes = await client.query<{ id: number; name: string; price: string }>(
        `SELECT id, name, price FROM packages WHERE id = $1`,
        [input.packageId]
      );
      if (pkgRes.rows.length === 0) {
        throw HttpError.notFound('Package not found');
      }
      const pkg = pkgRes.rows[0];
      const duration = input.durationMonths || 1;
      const packagePrice = Math.round(Number(pkg.price) * duration * 100) / 100;

      // 2. Fetch Subscriber
      const subRes = await client.query<{
        id: number;
        username: string;
        reseller_id: number | null;
        expiry_date: string | null;
      }>(`
        SELECT id, username, reseller_id, expiry_date
          FROM subscribers
         WHERE id = $1
         FOR UPDATE
      `, [input.subscriberId]);
      if (subRes.rows.length === 0) {
        throw HttpError.notFound('Customer not found');
      }
      const subscriber = subRes.rows[0];

      // 3. Lock Reseller and Wallet
      const wltRes = await client.query<{
        id: number;
        balance: string;
        total_used: string;
        status: string;
      }>(`
        SELECT id, balance, total_used, status
          FROM wallets
         WHERE reseller_id = $1
         FOR UPDATE
      `, [input.resellerId]);

      if (wltRes.rows.length === 0) {
        throw HttpError.notFound('Reseller wallet not found');
      }
      const wallet = wltRes.rows[0];

      if (wallet.status !== 'ACTIVE') {
        throw HttpError.badRequest('Reseller wallet is not active');
      }

      const balanceBefore = Number(wallet.balance || 0);

      // Section 41: Check balance >= package_price
      if (balanceBefore < packagePrice) {
        throw HttpError.badRequest(
          `Insufficient reseller balance. Available: Rs. ${balanceBefore.toFixed(2)}, Required: Rs. ${packagePrice.toFixed(2)}`
        );
      }

      const balanceAfter = Math.round((balanceBefore - packagePrice) * 100) / 100;
      const totalUsedAfter = Math.round((Number(wallet.total_used || 0) + packagePrice) * 100) / 100;

      // 4. Update Wallet balance
      await client.query(`
        UPDATE wallets
           SET balance = $1,
               total_used = $2,
               updated_at = NOW()
         WHERE id = $3
      `, [balanceAfter, totalUsedAfter, wallet.id]);

      // 5. Update Subscriber Expiry & Package
      const currentExpiry = subscriber.expiry_date ? new Date(subscriber.expiry_date) : new Date();
      const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
      const newExpiry = new Date(baseDate);
      newExpiry.setMonth(newExpiry.getMonth() + duration);

      await client.query(`
        UPDATE subscribers
           SET package_id = $1,
               status = 'enabled',
               reseller_id = COALESCE(reseller_id, $2),
               ownership_type = CASE WHEN reseller_id IS NULL THEN 'reseller' ELSE ownership_type END,
               expiry_date = $3,
               updated_at = NOW()
         WHERE id = $4
      `, [pkg.id, input.resellerId, newExpiry.toISOString(), subscriber.id]);

      // 6. Record in recharge_transactions for ISP billing history
      const rchTxId = `RCH-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await client.query(`
        INSERT INTO recharge_transactions (
          transaction_id, subscriber_id, username, package_id, package_name,
          duration, base_amount, discount_amount, final_amount,
          commission_amount, payment_method, status, reseller_id, created_by
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, 0.00, $7,
          0.00, 'RESELLER_WALLET', 'COMPLETED', $8, $9
        )
      `, [
        rchTxId,
        subscriber.id,
        subscriber.username,
        pkg.id,
        pkg.name,
        duration,
        packagePrice,
        input.resellerId,
        input.operator,
      ]);

      // 7. Insert dedicated RESELLER_CUSTOMER_RECHARGE ledger record
      const { rows } = await client.query<ResellerWalletTxRow>(`
        INSERT INTO reseller_wallet_transactions (
          transaction_id, reseller_id, wallet_id, type, status,
          cash_amount, credit_amount, commission_percent, commission_amount,
          wallet_value, wallet_debit, balance_before, balance_after,
          credit_used_before, credit_used_after,
          customer_id, customer_username, package_id, package_name,
          duration_months, payment_method, reference, remarks, created_by
        ) VALUES (
          $1, $2, $3, 'RESELLER_CUSTOMER_RECHARGE', 'COMPLETED',
          0.00, 0.00, 0.00, 0.00,
          0.00, $4, $5, $6,
          0.00, 0.00,
          $7, $8, $9, $10,
          $11, 'RESELLER_WALLET', $12, $13, $14
        )
        RETURNING *
      `, [
        rchTxId,
        input.resellerId,
        wallet.id,
        packagePrice,
        balanceBefore,
        balanceAfter,
        subscriber.id,
        subscriber.username,
        pkg.id,
        pkg.name,
        duration,
        `SUB-${subscriber.username}`,
        input.remarks || `Recharge package ${pkg.name} (${duration} mo)`,
        input.operator,
      ]);

      // 8. Mirror to wallet_transactions
      await client.query(`
        INSERT INTO wallet_transactions (
          transaction_id, wallet_id, type, amount, balance_before, balance_after,
          reference, payment_method, reason, created_by
        ) VALUES (
          $1, $2, 'DEBIT', $3, $4, $5, $6, 'RESELLER_WALLET', $7, $8
        )
        ON CONFLICT (transaction_id) DO NOTHING
      `, [
        rchTxId,
        wallet.id,
        packagePrice,
        balanceBefore,
        balanceAfter,
        `SUB-${subscriber.username}`,
        `Customer recharge: ${subscriber.username} for ${pkg.name}`,
        input.operator,
      ]);

      await client.query('COMMIT');

      await auditRepository.insert({
        username: input.operator,
        action: 'RESELLER_CUSTOMER_RECHARGE',
        entityType: 'reseller_wallet',
        entityId: String(input.resellerId),
        status: 'success',
        metadata: {
          transaction_id: rchTxId,
          subscriber_username: subscriber.username,
          package_name: pkg.name,
          package_price: packagePrice,
          wallet_balance_after: balanceAfter,
        },
      }).catch(() => undefined);

      return rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Reverse prior Top-Up transaction (creates immutable RESELLER_TOPUP_REVERSAL record)
   */
  async reverseTopup(input: {
    transactionId: string;
    reason: string;
    operator: string;
  }): Promise<ResellerWalletTxRow> {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const txRes = await client.query<ResellerWalletTxRow>(`
        SELECT *
          FROM reseller_wallet_transactions
         WHERE transaction_id = $1
         FOR UPDATE
      `, [input.transactionId]);

      if (txRes.rows.length === 0) {
        throw HttpError.notFound('Transaction not found');
      }
      const origTx = txRes.rows[0];

      if (origTx.status !== 'COMPLETED') {
        throw HttpError.badRequest(`Cannot reverse transaction with status ${origTx.status}`);
      }
      if (!['RESELLER_TOPUP_CASH', 'RESELLER_TOPUP_CREDIT'].includes(origTx.type)) {
        throw HttpError.badRequest(`Only top-up transactions can be reversed via this action`);
      }

      // Check reseller and wallet
      const resRes = await client.query<{ id: number; credit_used: string }>(`
        SELECT id, credit_used FROM resellers WHERE id = $1 FOR UPDATE
      `, [origTx.reseller_id]);
      const reseller = resRes.rows[0];

      const wltRes = await client.query<{ id: number; balance: string; total_topup: string }>(`
        SELECT id, balance, total_topup FROM wallets WHERE id = $1 FOR UPDATE
      `, [origTx.wallet_id]);
      const wallet = wltRes.rows[0];

      const balanceBefore = Number(wallet.balance || 0);
      const walletValueToReverse = Number(origTx.wallet_value || 0);

      // Section 41: wallet balance cannot become negative
      if (balanceBefore < walletValueToReverse) {
        throw HttpError.badRequest(
          `Cannot reverse top-up: wallet balance (Rs. ${balanceBefore.toFixed(2)}) is lower than top-up value (Rs. ${walletValueToReverse.toFixed(2)}). Balance already spent on customer recharges.`
        );
      }

      const balanceAfter = Math.round((balanceBefore - walletValueToReverse) * 100) / 100;
      const totalTopupAfter = Math.max(0, Math.round((Number(wallet.total_topup || 0) - walletValueToReverse) * 100) / 100);

      // Update wallet
      await client.query(`
        UPDATE wallets
           SET balance = $1,
               total_topup = $2,
               updated_at = NOW()
         WHERE id = $3
      `, [balanceAfter, totalTopupAfter, wallet.id]);

      // Adjust credit if original was credit top-up
      let creditUsedBefore = Number(reseller?.credit_used || 0);
      let creditUsedAfter = creditUsedBefore;
      if (origTx.type === 'RESELLER_TOPUP_CREDIT') {
        const creditReversed = Number(origTx.credit_amount || 0);
        creditUsedAfter = Math.max(0, creditUsedBefore - creditReversed);
        await client.query(`
          UPDATE resellers SET credit_used = $1, updated_at = NOW() WHERE id = $2
        `, [creditUsedAfter, origTx.reseller_id]);

        await client.query(`
          UPDATE credit_accounts SET used_credit = $1, updated_at = NOW() WHERE wallet_id = $2
        `, [creditUsedAfter, wallet.id]);
      }

      // Mark original as REVERSED
      await client.query(`
        UPDATE reseller_wallet_transactions
           SET status = 'REVERSED',
               remarks = COALESCE(remarks, '') || ' [REVERSED by ' || $1 || ' on ' || NOW() || ']'
         WHERE transaction_id = $2
      `, [input.operator, origTx.transaction_id]);

      // Insert new reversal ledger record
      const revTxId = `REV-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const { rows } = await client.query<ResellerWalletTxRow>(`
        INSERT INTO reseller_wallet_transactions (
          transaction_id, reseller_id, wallet_id, type, status,
          cash_amount, credit_amount, commission_percent, commission_amount,
          wallet_value, wallet_debit, balance_before, balance_after,
          credit_used_before, credit_used_after, payment_method,
          reference, remarks, reversal_of_id, created_by
        ) VALUES (
          $1, $2, $3, 'RESELLER_TOPUP_REVERSAL', 'COMPLETED',
          $4, $5, $6, $7,
          0.00, $8, $9, $10,
          $11, $12, $13,
          $14, $15, $16, $17
        )
        RETURNING *
      `, [
        revTxId,
        origTx.reseller_id,
        wallet.id,
        origTx.cash_amount,
        origTx.credit_amount,
        origTx.commission_percent,
        origTx.commission_amount,
        walletValueToReverse,
        balanceBefore,
        balanceAfter,
        creditUsedBefore,
        creditUsedAfter,
        origTx.payment_method,
        `REV-FOR-${origTx.transaction_id}`,
        input.reason || `Reversal of top-up ${origTx.transaction_id}`,
        origTx.transaction_id,
        input.operator,
      ]);

      await client.query('COMMIT');
      return rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Update Reseller Commission % with audit history
   */
  async updateCommission(resellerId: number, newPercent: number, reason: string, operator: string) {
    if (isNaN(newPercent) || newPercent < 0 || newPercent >= 100) {
      throw HttpError.badRequest('Commission percentage must be between 0% and 99.99%');
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const resRes = await client.query<{ id: number; commission_percent: string }>(`
        SELECT id, commission_percent FROM resellers WHERE id = $1 FOR UPDATE
      `, [resellerId]);

      if (resRes.rows.length === 0) {
        throw HttpError.notFound('Reseller not found');
      }
      const previousPercent = Number(resRes.rows[0].commission_percent || 0);

      // Record in history
      await client.query(`
        INSERT INTO reseller_commission_history (reseller_id, previous_percent, new_percent, changed_by, reason)
        VALUES ($1, $2, $3, $4, $5)
      `, [resellerId, previousPercent, newPercent, operator, reason || null]);

      // Update reseller
      await client.query(`
        UPDATE resellers
           SET commission_percent = $1,
               updated_at = NOW()
         WHERE id = $2
      `, [newPercent, resellerId]);

      await client.query('COMMIT');

      await auditRepository.insert({
        username: operator,
        action: 'RESELLER_COMMISSION_UPDATE',
        entityType: 'reseller',
        entityId: String(resellerId),
        status: 'success',
        metadata: { previous_percent: previousPercent, new_percent: newPercent, reason },
      }).catch(() => undefined);

      return { resellerId, previousPercent, newPercent };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Update Reseller Credit Facility
   */
  async updateCreditFacility(
    resellerId: number,
    creditLimit: number,
    creditStatus: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED',
    operator: string,
    notes?: string
  ) {
    if (isNaN(creditLimit) || creditLimit < 0) {
      throw HttpError.badRequest('Credit limit must be 0 or positive');
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const resRes = await client.query<{ id: number }>(`
        SELECT id FROM resellers WHERE id = $1 FOR UPDATE
      `, [resellerId]);
      if (resRes.rows.length === 0) throw HttpError.notFound('Reseller not found');

      await client.query(`
        UPDATE resellers
           SET credit_limit = $1,
               credit_status = $2,
               updated_at = NOW()
         WHERE id = $3
      `, [creditLimit, creditStatus, resellerId]);

      await client.query(`
        UPDATE credit_accounts ca
           SET credit_limit = $1,
               status = $2,
               notes = COALESCE($4, ca.notes),
               updated_by = $5,
               updated_at = NOW()
          FROM wallets w
         WHERE ca.wallet_id = w.id AND w.reseller_id = $3
      `, [creditLimit, creditStatus, resellerId, notes || null, operator]);

      await client.query('COMMIT');
      return { resellerId, creditLimit, creditStatus };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Get Reseller Commission History
   */
  async getCommissionHistory(resellerId: number) {
    const { rows } = await query<{
      id: number;
      reseller_id: number;
      previous_percent: number;
      new_percent: number;
      changed_by: string;
      reason: string | null;
      created_at: string;
    }>(`
      SELECT id, reseller_id, previous_percent::float, new_percent::float, changed_by, reason, created_at
        FROM reseller_commission_history
       WHERE reseller_id = $1
       ORDER BY created_at DESC
    `, [resellerId]);
    return rows;
  }

  /**
   * Reseller Profile Dashboard — Computes all 10 Clickable Dashboard Cards
   */
  async getResellerDashboard(resellerId: number) {
    const [resRow, wltRow, statsRow, subRow, todayRow, recentTx] = await Promise.all([
      query<{
        id: number;
        name: string;
        code: string;
        contact_person: string | null;
        phone: string | null;
        email: string | null;
        address: string | null;
        status: string;
        commission_percent: string;
        credit_limit: string;
        credit_used: string;
        credit_status: string;
        branch_id: number | null;
        branch_name: string | null;
        created_at: string;
      }>(`
        SELECT r.id, r.name, r.code, r.contact_person, r.phone, r.email, r.address,
               r.status, r.commission_percent, r.credit_limit, r.credit_used, r.credit_status,
               r.branch_id, b.name AS branch_name, r.created_at
          FROM resellers r
          LEFT JOIN branches b ON b.id = r.branch_id
         WHERE r.id = $1
      `, [resellerId]),

      query<{ balance: string; total_topup: string; total_used: string; wallet_number: string }>(`
        SELECT balance, total_topup, total_used, wallet_number
          FROM wallets
         WHERE reseller_id = $1
      `, [resellerId]),

      query<{
        total_cash_topup: string;
        total_credit_topup: string;
        total_commission: string;
        total_wallet_value: string;
        total_customer_recharge: string;
      }>(`
        SELECT
          COALESCE(SUM(cash_amount) FILTER (WHERE type = 'RESELLER_TOPUP_CASH' AND status = 'COMPLETED'), 0) -
          COALESCE(SUM(cash_amount) FILTER (WHERE type = 'RESELLER_TOPUP_REVERSAL'), 0) AS total_cash_topup,

          COALESCE(SUM(credit_amount) FILTER (WHERE type = 'RESELLER_TOPUP_CREDIT' AND status = 'COMPLETED'), 0) -
          COALESCE(SUM(credit_amount) FILTER (WHERE type = 'RESELLER_TOPUP_REVERSAL'), 0) AS total_credit_topup,

          COALESCE(SUM(commission_amount) FILTER (WHERE type IN ('RESELLER_TOPUP_CASH', 'RESELLER_TOPUP_CREDIT') AND status = 'COMPLETED'), 0) -
          COALESCE(SUM(commission_amount) FILTER (WHERE type = 'RESELLER_TOPUP_REVERSAL'), 0) AS total_commission,

          COALESCE(SUM(wallet_value) FILTER (WHERE type IN ('RESELLER_TOPUP_CASH', 'RESELLER_TOPUP_CREDIT') AND status = 'COMPLETED'), 0) -
          COALESCE(SUM(wallet_debit) FILTER (WHERE type = 'RESELLER_TOPUP_REVERSAL'), 0) AS total_wallet_value,

          COALESCE(SUM(wallet_debit) FILTER (WHERE type = 'RESELLER_CUSTOMER_RECHARGE' AND status = 'COMPLETED'), 0) AS total_customer_recharge
        FROM reseller_wallet_transactions
        WHERE reseller_id = $1
      `, [resellerId]),

      query<{ total_customers: string; active_customers: string; expired_customers: string }>(`
        SELECT
          COUNT(*) AS total_customers,
          COUNT(*) FILTER (WHERE status = 'enabled' AND (expiry_date IS NULL OR expiry_date > NOW())) AS active_customers,
          COUNT(*) FILTER (WHERE expiry_date <= NOW()) AS expired_customers
        FROM subscribers
        WHERE reseller_id = $1
      `, [resellerId]),

      query<{ today_recharge: string }>(`
        SELECT COALESCE(SUM(wallet_debit), 0) AS today_recharge
          FROM reseller_wallet_transactions
         WHERE reseller_id = $1
           AND type = 'RESELLER_CUSTOMER_RECHARGE'
           AND status = 'COMPLETED'
           AND created_at >= CURRENT_DATE
      `, [resellerId]),

      query<ResellerWalletTxRow>(`
        SELECT *
          FROM reseller_wallet_transactions
         WHERE reseller_id = $1
         ORDER BY created_at DESC
         LIMIT 10
      `, [resellerId]),
    ]);

    if (resRow.rows.length === 0) {
      throw HttpError.notFound('Reseller not found');
    }

    const r = resRow.rows[0];
    const w = wltRow.rows[0];
    const stats = statsRow.rows[0];
    const subs = subRow.rows[0];
    const today = todayRow.rows[0];

    const walletBalance = Number(w?.balance || 0);
    const creditLimit = Number(r.credit_limit || 0);
    const creditUsed = Number(r.credit_used || 0);
    const creditRemaining = Math.max(0, creditLimit - creditUsed);

    return {
      reseller: {
        id: r.id,
        name: r.name,
        code: r.code,
        contact_person: r.contact_person,
        phone: r.phone,
        email: r.email,
        address: r.address,
        status: r.status,
        commission_percent: Number(r.commission_percent || 50.00),
        credit_limit: creditLimit,
        credit_used: creditUsed,
        credit_remaining: creditRemaining,
        credit_status: r.credit_status,
        branch_id: r.branch_id,
        branch_name: r.branch_name,
        created_at: r.created_at,
        wallet_number: w?.wallet_number || `WLT-RES-${r.code}`,
      },
      cards: {
        currentBalance: walletBalance,
        totalCashTopup: Number(stats?.total_cash_topup || 0),
        totalCreditTopup: Number(stats?.total_credit_topup || 0),
        totalCommissionGranted: Number(stats?.total_commission || 0),
        totalWalletValueReceived: Number(stats?.total_wallet_value || 0),
        totalCustomerRecharge: Number(stats?.total_customer_recharge || 0),
        totalCreditUsed: creditUsed,
        creditRemaining: creditRemaining,
        customers: Number(subs?.total_customers || 0),
        todayRecharge: Number(today?.today_recharge || 0),
      },
      customersSummary: {
        total: Number(subs?.total_customers || 0),
        active: Number(subs?.active_customers || 0),
        expired: Number(subs?.expired_customers || 0),
      },
      recentTransactions: recentTx.rows,
    };
  }

  /**
   * Filterable Ledger Transactions for Reseller
   */
  async listTransactions(filter: ResellerTxFilter) {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filter.reseller_id) {
      conditions.push(`t.reseller_id = $${idx++}`);
      params.push(filter.reseller_id);
    }
    if (filter.type) {
      conditions.push(`t.type = $${idx++}`);
      params.push(filter.type);
    }
    if (filter.status) {
      conditions.push(`t.status = $${idx++}`);
      params.push(filter.status);
    }
    if (filter.payment_method) {
      conditions.push(`t.payment_method = $${idx++}`);
      params.push(filter.payment_method);
    }
    if (filter.customer_id) {
      conditions.push(`t.customer_id = $${idx++}`);
      params.push(filter.customer_id);
    }
    if (filter.start_date) {
      conditions.push(`t.created_at >= $${idx++}`);
      params.push(filter.start_date);
    }
    if (filter.end_date) {
      conditions.push(`t.created_at <= $${idx++}`);
      params.push(filter.end_date);
    }
    if (filter.search) {
      conditions.push(`(t.transaction_id ILIKE $${idx} OR t.customer_username ILIKE $${idx} OR t.reference ILIKE $${idx} OR r.name ILIKE $${idx})`);
      params.push(`%${filter.search}%`);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query<{ count: string }>(`
      SELECT COUNT(*) AS count
        FROM reseller_wallet_transactions t
        LEFT JOIN resellers r ON r.id = t.reseller_id
       ${where}
    `, params);
    const total = Number(countRes.rows[0]?.count || 0);

    const limit = filter.limit || 50;
    const offset = filter.offset || 0;

    const dataRes = await query<ResellerWalletTxRow>(`
      SELECT t.*, r.name AS reseller_name, r.code AS reseller_code
        FROM reseller_wallet_transactions t
        LEFT JOIN resellers r ON r.id = t.reseller_id
       ${where}
       ORDER BY t.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}
    `, [...params, limit, offset]);

    return {
      total,
      limit,
      offset,
      transactions: dataRes.rows,
    };
  }

  /**
   * Reseller Customers List
   */
  async listResellerCustomers(resellerId: number, search?: string) {
    const params: any[] = [resellerId];
    let searchClause = '';
    if (search) {
      params.push(`%${search}%`);
      searchClause = `AND (s.username ILIKE $2 OR s.full_name ILIKE $2 OR s.phone ILIKE $2 OR s.email ILIKE $2)`;
    }

    const { rows } = await query<{
      id: number;
      username: string;
      full_name: string;
      phone: string | null;
      email: string | null;
      package_id: number | null;
      package_name: string | null;
      package_price: number;
      status: string;
      expiry_date: string | null;
      created_at: string;
    }>(`
      SELECT s.id, s.username, s.full_name, s.phone, s.email,
             s.package_id, p.name AS package_name, COALESCE(p.price, 0)::float AS package_price,
             s.status, s.expiry_date, s.created_at
        FROM subscribers s
        LEFT JOIN packages p ON p.id = s.package_id
       WHERE s.reseller_id = $1
       ${searchClause}
       ORDER BY s.created_at DESC
    `, params);
    return rows;
  }

  /**
   * Comprehensive Financial Reports with Strict Section 29 Compliance
   * Cash Revenue = Actual Cash Received (Never Wallet Value!)
   */
  async getResellerReports(filter: ResellerReportFilter) {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filter.reseller_id) {
      conditions.push(`t.reseller_id = $${idx++}`);
      params.push(filter.reseller_id);
    }
    if (filter.type) {
      conditions.push(`t.type = $${idx++}`);
      params.push(filter.type);
    }
    if (filter.status) {
      conditions.push(`t.status = $${idx++}`);
      params.push(filter.status);
    }
    if (filter.payment_method) {
      conditions.push(`t.payment_method = $${idx++}`);
      params.push(filter.payment_method);
    }

    // Period Presets
    if (filter.period) {
      switch (filter.period) {
        case 'today':
          conditions.push(`t.created_at >= CURRENT_DATE`);
          break;
        case 'yesterday':
          conditions.push(`t.created_at >= CURRENT_DATE - INTERVAL '1 day' AND t.created_at < CURRENT_DATE`);
          break;
        case 'this_week':
          conditions.push(`t.created_at >= date_trunc('week', CURRENT_DATE)`);
          break;
        case 'last_week':
          conditions.push(`t.created_at >= date_trunc('week', CURRENT_DATE - INTERVAL '1 week') AND t.created_at < date_trunc('week', CURRENT_DATE)`);
          break;
        case 'this_month':
          conditions.push(`t.created_at >= date_trunc('month', CURRENT_DATE)`);
          break;
        case 'last_month':
          conditions.push(`t.created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month') AND t.created_at < date_trunc('month', CURRENT_DATE)`);
          break;
        case 'this_year':
          conditions.push(`t.created_at >= date_trunc('year', CURRENT_DATE)`);
          break;
        case 'custom':
          if (filter.start_date) {
            conditions.push(`t.created_at >= $${idx++}`);
            params.push(filter.start_date);
          }
          if (filter.end_date) {
            conditions.push(`t.created_at <= $${idx++}`);
            params.push(filter.end_date);
          }
          break;
      }
    } else {
      if (filter.start_date) {
        conditions.push(`t.created_at >= $${idx++}`);
        params.push(filter.start_date);
      }
      if (filter.end_date) {
        conditions.push(`t.created_at <= $${idx++}`);
        params.push(filter.end_date);
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 1. Report Totals
    const totalsRes = await query<{
      total_cash_received: string;
      total_credit_granted: string;
      total_commission_granted: string;
      total_wallet_value_added: string;
      total_customer_recharge: string;
      total_refund: string;
      total_reversal: string;
    }>(`
      SELECT
        COALESCE(SUM(t.cash_amount) FILTER (WHERE t.type = 'RESELLER_TOPUP_CASH' AND t.status = 'COMPLETED'), 0) -
        COALESCE(SUM(t.cash_amount) FILTER (WHERE t.type = 'RESELLER_TOPUP_REVERSAL'), 0) AS total_cash_received,

        COALESCE(SUM(t.credit_amount) FILTER (WHERE t.type = 'RESELLER_TOPUP_CREDIT' AND t.status = 'COMPLETED'), 0) -
        COALESCE(SUM(t.credit_amount) FILTER (WHERE t.type = 'RESELLER_TOPUP_REVERSAL'), 0) AS total_credit_granted,

        COALESCE(SUM(t.commission_amount) FILTER (WHERE t.type IN ('RESELLER_TOPUP_CASH', 'RESELLER_TOPUP_CREDIT') AND t.status = 'COMPLETED'), 0) -
        COALESCE(SUM(t.commission_amount) FILTER (WHERE t.type = 'RESELLER_TOPUP_REVERSAL'), 0) AS total_commission_granted,

        COALESCE(SUM(t.wallet_value) FILTER (WHERE t.type IN ('RESELLER_TOPUP_CASH', 'RESELLER_TOPUP_CREDIT') AND t.status = 'COMPLETED'), 0) -
        COALESCE(SUM(t.wallet_debit) FILTER (WHERE t.type = 'RESELLER_TOPUP_REVERSAL'), 0) AS total_wallet_value_added,

        COALESCE(SUM(t.wallet_debit) FILTER (WHERE t.type = 'RESELLER_CUSTOMER_RECHARGE' AND t.status = 'COMPLETED'), 0) AS total_customer_recharge,

        COALESCE(SUM(t.wallet_debit) FILTER (WHERE t.type = 'RESELLER_WALLET_REFUND'), 0) AS total_refund,

        COALESCE(SUM(t.wallet_debit) FILTER (WHERE t.type = 'RESELLER_TOPUP_REVERSAL'), 0) AS total_reversal
      FROM reseller_wallet_transactions t
      ${where}
    `, params);

    const tot = totalsRes.rows[0];
    const totalCashReceived = Number(tot?.total_cash_received || 0);
    const totalCreditGranted = Number(tot?.total_credit_granted || 0);
    const totalCommissionGranted = Number(tot?.total_commission_granted || 0);
    const totalWalletValueAdded = Number(tot?.total_wallet_value_added || 0);
    const totalCustomerRecharge = Number(tot?.total_customer_recharge || 0);
    const totalRefund = Number(tot?.total_refund || 0);
    const totalReversal = Number(tot?.total_reversal || 0);

    // Section 29 Mandatory Rule: Cash revenue is strictly cash received
    const actualCashRevenue = totalCashReceived;

    // 2. Daily Time Series
    const timeSeriesRes = await query<{
      date: string;
      cash_received: string;
      credit_granted: string;
      commission_granted: string;
      wallet_added: string;
      customer_recharge: string;
    }>(`
      SELECT
        TO_CHAR(t.created_at, 'YYYY-MM-DD') AS date,
        COALESCE(SUM(t.cash_amount) FILTER (WHERE t.type = 'RESELLER_TOPUP_CASH' AND t.status = 'COMPLETED'), 0) AS cash_received,
        COALESCE(SUM(t.credit_amount) FILTER (WHERE t.type = 'RESELLER_TOPUP_CREDIT' AND t.status = 'COMPLETED'), 0) AS credit_granted,
        COALESCE(SUM(t.commission_amount) FILTER (WHERE t.type IN ('RESELLER_TOPUP_CASH', 'RESELLER_TOPUP_CREDIT') AND t.status = 'COMPLETED'), 0) AS commission_granted,
        COALESCE(SUM(t.wallet_value) FILTER (WHERE t.type IN ('RESELLER_TOPUP_CASH', 'RESELLER_TOPUP_CREDIT') AND t.status = 'COMPLETED'), 0) AS wallet_added,
        COALESCE(SUM(t.wallet_debit) FILTER (WHERE t.type = 'RESELLER_CUSTOMER_RECHARGE' AND t.status = 'COMPLETED'), 0) AS customer_recharge
      FROM reseller_wallet_transactions t
      ${where}
      GROUP BY TO_CHAR(t.created_at, 'YYYY-MM-DD')
      ORDER BY date ASC
    `, params);

    // 3. Per Reseller Breakdown
    const resellerBreakdownRes = await query<{
      reseller_id: number;
      reseller_name: string;
      reseller_code: string;
      commission_percent: number;
      wallet_balance: number;
      credit_limit: number;
      credit_used: number;
      cash_paid: number;
      credit_taken: number;
      commission_earned: number;
      wallet_credited: number;
      customer_recharges: number;
    }>(`
      SELECT
        r.id AS reseller_id,
        r.name AS reseller_name,
        r.code AS reseller_code,
        r.commission_percent::float AS commission_percent,
        COALESCE(w.balance, 0)::float AS wallet_balance,
        COALESCE(r.credit_limit, 0)::float AS credit_limit,
        COALESCE(r.credit_used, 0)::float AS credit_used,
        COALESCE(SUM(t.cash_amount) FILTER (WHERE t.type = 'RESELLER_TOPUP_CASH' AND t.status = 'COMPLETED'), 0)::float AS cash_paid,
        COALESCE(SUM(t.credit_amount) FILTER (WHERE t.type = 'RESELLER_TOPUP_CREDIT' AND t.status = 'COMPLETED'), 0)::float AS credit_taken,
        COALESCE(SUM(t.commission_amount) FILTER (WHERE t.type IN ('RESELLER_TOPUP_CASH', 'RESELLER_TOPUP_CREDIT') AND t.status = 'COMPLETED'), 0)::float AS commission_earned,
        COALESCE(SUM(t.wallet_value) FILTER (WHERE t.type IN ('RESELLER_TOPUP_CASH', 'RESELLER_TOPUP_CREDIT') AND t.status = 'COMPLETED'), 0)::float AS wallet_credited,
        COALESCE(SUM(t.wallet_debit) FILTER (WHERE t.type = 'RESELLER_CUSTOMER_RECHARGE' AND t.status = 'COMPLETED'), 0)::float AS customer_recharges
      FROM resellers r
      LEFT JOIN wallets w ON w.reseller_id = r.id
      LEFT JOIN reseller_wallet_transactions t ON t.reseller_id = r.id
      ${filter.reseller_id ? `WHERE r.id = ${filter.reseller_id}` : ''}
      GROUP BY r.id, r.name, r.code, r.commission_percent, w.balance, r.credit_limit, r.credit_used
      ORDER BY r.name ASC
    `);

    return {
      totals: {
        totalCashReceived,
        totalCreditGranted,
        totalCommissionGranted,
        totalWalletValueAdded,
        totalCustomerRecharge,
        totalRefund,
        totalReversal,
        cashRevenue: actualCashRevenue,
      },
      timeSeries: timeSeriesRes.rows.map((row) => ({
        date: row.date,
        cash_received: Number(row.cash_received),
        credit_granted: Number(row.credit_granted),
        commission_granted: Number(row.commission_granted),
        wallet_added: Number(row.wallet_added),
        customer_recharge: Number(row.customer_recharge),
      })),
      resellerBreakdown: resellerBreakdownRes.rows.map((r) => ({
        ...r,
        credit_remaining: Math.max(0, r.credit_limit - r.credit_used),
      })),
    };
  }

  /**
   * Export transactions as CSV string
   */
  async exportTransactionsCsv(filter: ResellerTxFilter): Promise<string> {
    const { transactions } = await this.listTransactions({ ...filter, limit: 5000, offset: 0 });

    const header = [
      'Date',
      'Transaction ID',
      'Reseller',
      'Type',
      'Status',
      'Cash Paid',
      'Credit Amount',
      'Commission %',
      'Commission Granted',
      'Wallet Value Added',
      'Wallet Debit',
      'Balance Before',
      'Balance After',
      'Customer',
      'Package',
      'Payment Method',
      'Reference',
      'Operator',
      'Remarks',
    ].join(',');

    const rows = transactions.map((tx) => [
      `"${new Date(tx.created_at).toISOString()}"`,
      `"${tx.transaction_id}"`,
      `"${tx.reseller_name || tx.reseller_id}"`,
      `"${tx.type}"`,
      `"${tx.status}"`,
      tx.cash_amount.toFixed(2),
      tx.credit_amount.toFixed(2),
      `${tx.commission_percent.toFixed(2)}%`,
      tx.commission_amount.toFixed(2),
      tx.wallet_value.toFixed(2),
      tx.wallet_debit.toFixed(2),
      tx.balance_before.toFixed(2),
      tx.balance_after.toFixed(2),
      `"${tx.customer_username || ''}"`,
      `"${tx.package_name || ''}"`,
      `"${tx.payment_method || ''}"`,
      `"${tx.reference || ''}"`,
      `"${tx.created_by}"`,
      `"${(tx.remarks || '').replace(/"/g, '""')}"`,
    ].join(','));

    return [header, ...rows].join('\n');
  }
}

export const resellerRepository = new ResellerRepository();
