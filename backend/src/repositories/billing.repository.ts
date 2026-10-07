import { query, pool } from '../db/pool';
import { subscriberRepository } from './subscriber.repository';
import { HttpError } from '../lib/http-error';

export interface PackagePriceRecord {
  id: number;
  package_id: number;
  duration_months: number;
  price: string;
  currency: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PackagePriceHistoryRecord {
  id: number;
  package_id: number;
  duration_months: number;
  old_price: string | null;
  new_price: string;
  currency: string;
  changed_by: string;
  reason: string | null;
  created_at: Date;
}

export interface PaymentMethodRecord {
  id: number;
  code: string;
  name: string;
  requires_reference: boolean;
  is_active: boolean;
  sort_order: number;
  description: string | null;
  created_at: Date;
}

export interface BillingTransactionRecord {
  id: number;
  transaction_id: string;
  receipt_no: string;
  subscriber_id: number;
  username: string;
  customer_id: string;
  full_name: string;
  package_id: number;
  package_name: string;
  duration: number;
  duration_unit: string;
  original_price: string;
  discount_type: string;
  discount_value: string;
  discount_amount: string;
  adjustment_amount: string;
  tax_rate: string;
  tax_amount: string;
  final_amount: string;
  currency: string;
  payment_method: string;
  payment_reference: string | null;
  recharge_date: Date;
  previous_expiry: Date | null;
  new_expiry: Date;
  status: string;
  created_by: string;
  notes: string | null;
  idempotency_key: string | null;
  organization_id: number | null;
  branch_id: number | null;
  reseller_id: number | null;
  wallet_id: number | null;
  commission_amount: string;
  created_at: Date;
}

export interface RefundRecord {
  id: number;
  refund_id: string;
  transaction_id: string;
  subscriber_id: number;
  amount: string;
  currency: string;
  refund_type: string;
  reason: string;
  refund_method: string;
  processed_by: string;
  created_at: Date;
}

export interface BillingAdjustmentRecord {
  id: number;
  adjustment_id: string;
  subscriber_id: number;
  adjustment_type: string;
  amount: string;
  days: number;
  reason: string;
  operator_username: string;
  created_at: Date;
}

export interface InvoiceRecord {
  id: number;
  invoice_no: string;
  transaction_id: string | null;
  subscriber_id: number;
  customer_name: string;
  customer_id: string;
  username: string;
  service_name: string;
  package_name: string;
  duration_months: number;
  price: string;
  discount_amount: string;
  tax_rate: string;
  tax_amount: string;
  total_amount: string;
  currency: string;
  status: string;
  issue_date: Date;
  due_date: Date | null;
  created_at: Date;
}

export interface ProcessRechargeInput {
  subscriber_id: number;
  package_id: number;
  duration_months: number;
  original_price?: number;
  discount_type?: 'none' | 'fixed' | 'percentage';
  discount_value?: number;
  tax_rate?: number;
  payment_method: string;
  payment_reference?: string;
  notes?: string;
  idempotency_key?: string;
  created_by: string;
  user_role?: string;
}

export const billingRepository = {
  // =========================================================================
  // 1. Package Pricing & Price History
  // =========================================================================
  async getPackagePrices(packageId: number): Promise<PackagePriceRecord[]> {
    const { rows } = await query<PackagePriceRecord>(
      `SELECT id, package_id, duration_months, price, currency, is_active, created_at, updated_at
         FROM package_prices
        WHERE package_id = $1 AND is_active = TRUE
        ORDER BY duration_months ASC`,
      [packageId],
    );
    return rows;
  },

  async setPackagePrice(
    packageId: number,
    durationMonths: number,
    price: number,
    currency = 'NPR',
    changedBy = 'admin',
    reason = 'Package price update',
  ): Promise<PackagePriceRecord> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check existing price
      const existingRes = await client.query<PackagePriceRecord>(
        `SELECT id, price, currency FROM package_prices WHERE package_id = $1 AND duration_months = $2`,
        [packageId, durationMonths],
      );
      const existing = existingRes.rows[0];

      // Upsert into package_prices
      const upsertRes = await client.query<PackagePriceRecord>(
        `INSERT INTO package_prices (package_id, duration_months, price, currency, is_active)
         VALUES ($1, $2, $3, $4, TRUE)
         ON CONFLICT (package_id, duration_months)
         DO UPDATE SET price = EXCLUDED.price, currency = EXCLUDED.currency, is_active = TRUE, updated_at = NOW()
         RETURNING id, package_id, duration_months, price, currency, is_active, created_at, updated_at`,
        [packageId, durationMonths, price, currency],
      );

      // Record audit history if price changed
      if (!existing || Number(existing.price) !== Number(price)) {
        await client.query(
          `INSERT INTO package_price_history (
             package_id, duration_months, old_price, new_price, currency, changed_by, reason
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            packageId,
            durationMonths,
            existing ? existing.price : null,
            price,
            currency,
            changedBy,
            reason,
          ],
        );

        await client.query(
          `INSERT INTO audit_logs (actor, action, target_type, target_id, details)
           VALUES ($1, 'package.price_updated', 'package', $2, $3)`,
          [
            changedBy,
            String(packageId),
            JSON.stringify({
              duration_months: durationMonths,
              old_price: existing?.price || null,
              new_price: price,
              currency,
              reason,
            }),
          ],
        );
      }

      await client.query('COMMIT');
      return upsertRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async getPackagePriceHistory(packageId?: number, limit = 50): Promise<PackagePriceHistoryRecord[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (packageId) {
      conditions.push(`package_id = $${idx++}`);
      values.push(packageId);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(limit);

    const { rows } = await query<PackagePriceHistoryRecord>(
      `SELECT pph.id, pph.package_id, pph.duration_months, pph.old_price, pph.new_price,
              pph.currency, pph.changed_by, pph.reason, pph.created_at
         FROM package_price_history pph
        ${where}
        ORDER BY pph.created_at DESC
        LIMIT $${idx}`,
      values,
    );
    return rows;
  },

  // =========================================================================
  // 2. Payment Methods
  // =========================================================================
  async getPaymentMethods(activeOnly = false): Promise<PaymentMethodRecord[]> {
    const where = activeOnly ? 'WHERE is_active = TRUE' : '';
    const { rows } = await query<PaymentMethodRecord>(
      `SELECT id, code, name, requires_reference, is_active, sort_order, description, created_at
         FROM payment_methods
        ${where}
        ORDER BY sort_order ASC, name ASC`,
    );
    return rows;
  },

  async togglePaymentMethod(id: number, isActive: boolean): Promise<PaymentMethodRecord> {
    const { rows } = await query<PaymentMethodRecord>(
      `UPDATE payment_methods
          SET is_active = $1
        WHERE id = $2
        RETURNING id, code, name, requires_reference, is_active, sort_order, description, created_at`,
      [isActive, id],
    );
    if (!rows.length) throw HttpError.notFound('Payment method not found');
    return rows[0];
  },

  // =========================================================================
  // 3. Core Recharge Processing (Transactional + Double Recharge Protection)
  // =========================================================================
  async processRecharge(input: ProcessRechargeInput): Promise<{
    transaction: BillingTransactionRecord;
    invoice: InvoiceRecord;
  }> {
    const {
      subscriber_id,
      package_id,
      duration_months,
      discount_type = 'none',
      discount_value = 0,
      tax_rate = 0,
      payment_method,
      payment_reference,
      notes,
      idempotency_key,
      created_by,
      user_role,
    } = input;

    if (duration_months <= 0) {
      throw HttpError.badRequest('Recharge duration must be at least 1 month');
    }

    // Double-recharge check via idempotency key
    if (idempotency_key) {
      const existingTx = await query<BillingTransactionRecord>(
        `SELECT rt.* FROM recharge_transactions rt WHERE rt.idempotency_key = $1`,
        [idempotency_key],
      );
      if (existingTx.rows.length > 0) {
        const invRes = await query<InvoiceRecord>(
          `SELECT * FROM invoices WHERE transaction_id = $1`,
          [existingTx.rows[0].transaction_id],
        );
        return { transaction: existingTx.rows[0], invoice: invRes.rows[0] };
      }
    }

    const subscriber = await subscriberRepository.findById(subscriber_id);
    if (!subscriber) throw HttpError.notFound('Subscriber not found');

    const pkgRes = await query<{ id: number; name: string; price: string; currency: string }>(
      `SELECT id, name, price, currency FROM packages WHERE id = $1`,
      [package_id],
    );
    if (!pkgRes.rows.length) throw HttpError.notFound('Package not found');
    const pkg = pkgRes.rows[0];

    // Determine Base Price
    let originalPrice = input.original_price;
    if (originalPrice === undefined || originalPrice <= 0) {
      const priceRes = await query<PackagePriceRecord>(
        `SELECT price FROM package_prices WHERE package_id = $1 AND duration_months = $2 AND is_active = TRUE`,
        [package_id, duration_months],
      );
      if (priceRes.rows.length > 0) {
        originalPrice = Number(priceRes.rows[0].price);
      } else {
        originalPrice = Number(pkg.price) * duration_months;
      }
    }

    // Validate & Calculate Discount
    let discountAmount = 0;
    if (discount_type === 'percentage') {
      const pct = Math.max(0, Math.min(100, Number(discount_value)));
      if (user_role === 'operator' && pct > 5) {
        throw HttpError.forbidden('Operators cannot give discounts exceeding 5%. Authorization required.');
      } else if (user_role === 'admin' && pct > 15) {
        throw HttpError.forbidden('Admins cannot give discounts exceeding 15%. Super Admin authorization required.');
      }
      discountAmount = Math.round((originalPrice * pct) / 100 * 100) / 100;
    } else if (discount_type === 'fixed') {
      const fixed = Math.max(0, Number(discount_value));
      const impliedPct = (fixed / originalPrice) * 100;
      if (user_role === 'operator' && impliedPct > 5) {
        throw HttpError.forbidden('Operators cannot give fixed discounts exceeding 5% of price.');
      } else if (user_role === 'admin' && impliedPct > 15) {
        throw HttpError.forbidden('Admins cannot give fixed discounts exceeding 15% of price.');
      }
      discountAmount = Math.min(originalPrice, fixed);
    }

    const priceAfterDiscount = Math.max(0, originalPrice - discountAmount);
    const taxAmount = tax_rate > 0 ? Math.round((priceAfterDiscount * tax_rate) / 100 * 100) / 100 : 0;
    const finalAmount = Math.round((priceAfterDiscount + taxAmount) * 100) / 100;

    // Expiry calculation:
    // If active and expiry > now, add from existing valid expiry.
    // If expired or missing, start from NOW.
    const now = new Date();
    let baseExpiry = now;
    if (subscriber.expiry_date && new Date(subscriber.expiry_date) > now) {
      baseExpiry = new Date(subscriber.expiry_date);
    }
    const newExpiry = new Date(baseExpiry);
    newExpiry.setMonth(newExpiry.getMonth() + duration_months);

    // Generate unique IDs
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    const transactionId = `REC-${dateStr}-${randomHex}`;
    const invoiceNo = `INV-${dateStr}-${randomHex}`;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert into recharge_transactions
      const insertTxSql = `
        INSERT INTO recharge_transactions (
          transaction_id, receipt_no, subscriber_id, username, customer_id, full_name,
          package_id, package_name, duration, duration_unit, original_price,
          discount_type, discount_value, discount_amount, adjustment_amount,
          tax_rate, tax_amount, final_amount, currency, payment_method,
          payment_reference, recharge_date, previous_expiry, new_expiry,
          status, created_by, notes, idempotency_key, duration_months, amount
        ) VALUES (
          $1, $1, $2, $3, $4, $5,
          $6, $7, $8, 'months', $9,
          $10, $11, $12, 0,
          $13, $14, $15, $16, $17,
          $18, NOW(), $19, $20,
          'COMPLETED', $21, $22, $23, $8, $15
        ) RETURNING *
      `;
      const txRes = await client.query<BillingTransactionRecord>(insertTxSql, [
        transactionId,
        subscriber.id,
        subscriber.username,
        subscriber.customer_id,
        subscriber.full_name,
        pkg.id,
        pkg.name,
        duration_months,
        originalPrice,
        discount_type,
        discount_value,
        discountAmount,
        tax_rate,
        taxAmount,
        finalAmount,
        pkg.currency,
        payment_method,
        payment_reference || null,
        subscriber.expiry_date,
        newExpiry,
        created_by,
        notes || null,
        idempotency_key || null,
      ]);
      const tx = txRes.rows[0];

      // 2. Insert Invoice
      const insertInvSql = `
        INSERT INTO invoices (
          invoice_no, transaction_id, subscriber_id, customer_name, customer_id,
          username, service_name, package_name, duration_months, price,
          discount_amount, tax_rate, tax_amount, total_amount, currency,
          status, issue_date, due_date
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, 'Broadband Internet', $7, $8, $9,
          $10, $11, $12, $13, $14,
          'PAID', NOW(), NOW()
        ) RETURNING *
      `;
      const invRes = await client.query<InvoiceRecord>(insertInvSql, [
        invoiceNo,
        transactionId,
        subscriber.id,
        subscriber.full_name,
        subscriber.customer_id,
        subscriber.username,
        pkg.name,
        duration_months,
        originalPrice,
        discountAmount,
        tax_rate,
        taxAmount,
        finalAmount,
        pkg.currency,
      ]);
      const invoice = invRes.rows[0];

      // 3. Update subscriber package, expiry, status
      await client.query(
        `UPDATE subscribers
            SET current_package_id = $1,
                expiry_date = $2,
                status = 'active',
                updated_at = NOW()
          WHERE id = $3`,
        [pkg.id, newExpiry, subscriber.id],
      );

      // 4. Update FreeRADIUS radcheck Expiration & Clear Reject
      await client.query(
        `UPDATE radcheck
            SET value = to_char($1::timestamptz, 'DD Mon YYYY 23:59:59')
          WHERE lower(username) = lower($2) AND attribute = 'Expiration'`,
        [newExpiry, subscriber.username],
      );
      await client.query(
        `DELETE FROM radcheck
          WHERE lower(username) = lower($1) AND attribute = 'Auth-Type' AND value = 'Reject'`,
        [subscriber.username],
      );

      // 5. Insert subscriber_services record
      const serviceId = `SRV-${subscriber.customer_id}-${randomHex}`;
      await client.query(
        `INSERT INTO subscriber_services (
           service_id, subscriber_id, package_id, start_date, expiry_date, status, created_by, notes
         ) VALUES ($1, $2, $3, NOW(), $4, 'active', $5, $6)`,
        [serviceId, subscriber.id, pkg.id, newExpiry, created_by, `Recharge: ${duration_months} Months (${transactionId})`],
      );

      // 6. Record Activity, Network Event & Audit Log
      await client.query(
        `INSERT INTO subscriber_activity (subscriber_id, action, details, admin_username)
         VALUES ($1, 'billing.recharge', $2, $3)`,
        [
          subscriber.id,
          `Recharged ${duration_months} mo (${pkg.name}) for ${pkg.currency} ${finalAmount}. Expiry: ${newExpiry.toISOString().slice(0, 10)}. Tx: ${transactionId}`,
          created_by,
        ],
      );

      await client.query(
        `INSERT INTO network_events (event_type, severity, actor, target, description, metadata)
         VALUES ('billing.recharge_completed', 'info', $1, $2, $3, $4)`,
        [
          created_by,
          subscriber.username,
          `Subscriber ${subscriber.username} recharged for ${duration_months} mo (${transactionId})`,
          JSON.stringify({ transactionId, invoiceNo, finalAmount, currency: pkg.currency, newExpiry }),
        ],
      );

      await client.query(
        `INSERT INTO audit_logs (actor, action, target_type, target_id, details)
         VALUES ($1, 'billing.recharge', 'subscriber', $2, $3)`,
        [
          created_by,
          String(subscriber.id),
          JSON.stringify({
            transactionId,
            invoiceNo,
            package: pkg.name,
            duration_months,
            originalPrice,
            discountAmount,
            finalAmount,
            payment_method,
            payment_reference,
            newExpiry,
          }),
        ],
      );

      await client.query('COMMIT');
      return { transaction: tx, invoice };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // =========================================================================
  // 4. Refunds & Cancellation
  // =========================================================================
  async processRefund(input: {
    transaction_id: string;
    amount?: number;
    reason: string;
    refund_method?: string;
    processed_by: string;
  }): Promise<RefundRecord> {
    const { transaction_id, reason, refund_method = 'Cash', processed_by } = input;

    const txRes = await query<BillingTransactionRecord>(
      `SELECT * FROM recharge_transactions WHERE transaction_id = $1`,
      [transaction_id],
    );
    if (!txRes.rows.length) throw HttpError.notFound('Transaction not found');
    const tx = txRes.rows[0];

    if (tx.status !== 'COMPLETED' && tx.status !== 'PARTIALLY_REFUNDED') {
      throw HttpError.badRequest(`Cannot refund transaction with status ${tx.status}`);
    }

    // Check previously refunded amount
    const prevRefundsRes = await query<{ sum: string }>(
      `SELECT COALESCE(SUM(amount), 0) as sum FROM refunds WHERE transaction_id = $1`,
      [transaction_id],
    );
    const previouslyRefunded = Number(prevRefundsRes.rows[0]?.sum || '0');
    const remainingRefundable = Number(tx.final_amount) - previouslyRefunded;

    const refundAmount = input.amount !== undefined && input.amount > 0
      ? Math.min(input.amount, remainingRefundable)
      : remainingRefundable;

    if (refundAmount <= 0) {
      throw HttpError.badRequest('No refundable amount remaining on this transaction');
    }

    const isFull = refundAmount >= remainingRefundable;
    const refundType = isFull && previouslyRefunded === 0 ? 'full' : 'partial';

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    const refundId = `REF-${dateStr}-${randomHex}`;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const refundRes = await client.query<RefundRecord>(
        `INSERT INTO refunds (
           refund_id, transaction_id, subscriber_id, amount, currency,
           refund_type, reason, refund_method, processed_by, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         RETURNING *`,
        [
          refundId,
          transaction_id,
          tx.subscriber_id,
          refundAmount,
          tx.currency,
          refundType,
          reason,
          refund_method,
          processed_by,
        ],
      );

      const newTxStatus = isFull ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      await client.query(
        `UPDATE recharge_transactions SET status = $1 WHERE transaction_id = $2`,
        [newTxStatus, transaction_id],
      );

      await client.query(
        `INSERT INTO audit_logs (actor, action, target_type, target_id, details)
         VALUES ($1, 'billing.refund', 'transaction', $2, $3)`,
        [
          processed_by,
          transaction_id,
          JSON.stringify({ refundId, refundAmount, refundType, reason, refund_method }),
        ],
      );

      await client.query(
        `INSERT INTO subscriber_activity (subscriber_id, action, details, admin_username)
         VALUES ($1, 'billing.refund', $2, $3)`,
        [
          tx.subscriber_id,
          `Refund of ${tx.currency} ${refundAmount} issued for ${transaction_id}. Reason: ${reason} (${refundId})`,
          processed_by,
        ],
      );

      await client.query('COMMIT');
      return refundRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async cancelTransaction(transactionId: string, reason: string, operator: string): Promise<void> {
    const txRes = await query<BillingTransactionRecord>(
      `SELECT * FROM recharge_transactions WHERE transaction_id = $1`,
      [transactionId],
    );
    if (!txRes.rows.length) throw HttpError.notFound('Transaction not found');
    const tx = txRes.rows[0];

    if (tx.status !== 'PENDING') {
      throw HttpError.badRequest('Only PENDING transactions can be cancelled. Completed transactions must be refunded.');
    }

    await query(
      `UPDATE recharge_transactions SET status = 'CANCELLED', notes = COALESCE(notes, '') || ' [Cancelled: ' || $1 || ']' WHERE transaction_id = $2`,
      [reason, transactionId],
    );

    await query(
      `INSERT INTO audit_logs (actor, action, target_type, target_id, details)
       VALUES ($1, 'billing.cancel_transaction', 'transaction', $2, $3)`,
      [operator, transactionId, JSON.stringify({ reason })],
    );
  },

  // =========================================================================
  // 5. Manual Adjustments
  // =========================================================================
  async createAdjustment(input: {
    subscriber_id: number;
    adjustment_type: 'amount' | 'expiry' | 'credit' | 'discount';
    amount?: number;
    days?: number;
    reason: string;
    operator_username: string;
  }): Promise<BillingAdjustmentRecord> {
    const { subscriber_id, adjustment_type, amount = 0, days = 0, reason, operator_username } = input;
    const subscriber = await subscriberRepository.findById(subscriber_id);
    if (!subscriber) throw HttpError.notFound('Subscriber not found');

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    const adjustmentId = `ADJ-${dateStr}-${randomHex}`;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const adjRes = await client.query<BillingAdjustmentRecord>(
        `INSERT INTO billing_adjustments (
           adjustment_id, subscriber_id, adjustment_type, amount, days, reason, operator_username
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [adjustmentId, subscriber_id, adjustment_type, amount, days, reason, operator_username],
      );

      // If adjusting expiry, modify subscriber's expiry date
      if (adjustment_type === 'expiry' && days !== 0) {
        const currentExp = subscriber.expiry_date ? new Date(subscriber.expiry_date) : new Date();
        currentExp.setDate(currentExp.getDate() + days);

        await client.query(
          `UPDATE subscribers SET expiry_date = $1, updated_at = NOW() WHERE id = $2`,
          [currentExp, subscriber_id],
        );
        await client.query(
          `UPDATE radcheck SET value = to_char($1::timestamptz, 'DD Mon YYYY 23:59:59')
            WHERE lower(username) = lower($2) AND attribute = 'Expiration'`,
          [currentExp, subscriber.username],
        );
      }

      await client.query(
        `INSERT INTO subscriber_activity (subscriber_id, action, details, admin_username)
         VALUES ($1, 'billing.adjustment', $2, $3)`,
        [
          subscriber_id,
          `Manual ${adjustment_type} adjustment: ${days !== 0 ? `${days} days` : `Rs. ${amount}`}. Reason: ${reason} (${adjustmentId})`,
          operator_username,
        ],
      );

      await client.query(
        `INSERT INTO audit_logs (actor, action, target_type, target_id, details)
         VALUES ($1, 'billing.adjustment', 'subscriber', $2, $3)`,
        [operator_username, String(subscriber_id), JSON.stringify({ adjustmentId, adjustment_type, amount, days, reason })],
      );

      await client.query('COMMIT');
      return adjRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // =========================================================================
  // 6. Transactions Listing & Details
  // =========================================================================
  async listTransactions(options: {
    subscriberId?: number;
    status?: string;
    paymentMethod?: string;
    packageId?: number;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: BillingTransactionRecord[]; total: number }> {
    const {
      subscriberId,
      status,
      paymentMethod,
      packageId,
      search,
      dateFrom,
      dateTo,
      limit = 50,
      offset = 0,
    } = options;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (subscriberId) {
      conditions.push(`rt.subscriber_id = $${idx++}`);
      values.push(subscriberId);
    }
    if (status) {
      conditions.push(`rt.status = $${idx++}`);
      values.push(status);
    }
    if (paymentMethod) {
      conditions.push(`rt.payment_method = $${idx++}`);
      values.push(paymentMethod);
    }
    if (packageId) {
      conditions.push(`rt.package_id = $${idx++}`);
      values.push(packageId);
    }
    if (dateFrom) {
      conditions.push(`rt.recharge_date >= $${idx++}`);
      values.push(dateFrom);
    }
    if (dateTo) {
      conditions.push(`rt.recharge_date <= $${idx++}`);
      values.push(dateTo);
    }
    if (search && search.trim()) {
      conditions.push(
        `(rt.transaction_id ILIKE $${idx} OR rt.receipt_no ILIKE $${idx} OR rt.username ILIKE $${idx} OR rt.customer_id ILIKE $${idx} OR rt.payment_reference ILIKE $${idx})`,
      );
      values.push(`%${search.trim()}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query<{ count: string }>(
      `SELECT count(*) as count FROM recharge_transactions rt ${where}`,
      values,
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const listSql = `
      SELECT rt.*
        FROM recharge_transactions rt
       ${where}
       ORDER BY rt.recharge_date DESC
       LIMIT $${idx++} OFFSET $${idx++}
    `;
    values.push(limit, offset);

    const { rows } = await query<BillingTransactionRecord>(listSql, values);
    return { items: rows, total };
  },

  async getTransactionDetails(transactionId: string): Promise<{
    transaction: BillingTransactionRecord;
    invoice: InvoiceRecord | null;
    refunds: RefundRecord[];
    timeline: { timestamp: Date; action: string; actor: string; details: string }[];
  }> {
    const txRes = await query<BillingTransactionRecord>(
      `SELECT * FROM recharge_transactions WHERE transaction_id = $1 OR receipt_no = $1`,
      [transactionId],
    );
    if (!txRes.rows.length) throw HttpError.notFound('Transaction not found');
    const transaction = txRes.rows[0];

    const invRes = await query<InvoiceRecord>(
      `SELECT * FROM invoices WHERE transaction_id = $1`,
      [transaction.transaction_id],
    );
    const invoice = invRes.rows[0] || null;

    const refRes = await query<RefundRecord>(
      `SELECT * FROM refunds WHERE transaction_id = $1 ORDER BY created_at ASC`,
      [transaction.transaction_id],
    );

    // Build Audit Timeline
    const timeline = [
      {
        timestamp: transaction.recharge_date,
        action: 'Transaction Created & Recorded',
        actor: transaction.created_by,
        details: `Recharge for ${transaction.duration} month(s) (${transaction.package_name}). Total: ${transaction.currency} ${transaction.final_amount}`,
      },
      {
        timestamp: transaction.recharge_date,
        action: 'Payment Captured',
        actor: transaction.created_by,
        details: `Method: ${transaction.payment_method}${transaction.payment_reference ? ` (Ref: ${transaction.payment_reference})` : ''}`,
      },
      {
        timestamp: transaction.recharge_date,
        action: 'Subscriber Expiry Updated',
        actor: 'system',
        details: `New expiration set to ${new Date(transaction.new_expiry).toISOString().slice(0, 10)}`,
      },
    ];

    for (const r of refRes.rows) {
      timeline.push({
        timestamp: r.created_at,
        action: `Refund Processed (${r.refund_type.toUpperCase()})`,
        actor: r.processed_by,
        details: `${r.currency} ${r.amount} refunded. Reason: ${r.reason} (${r.refund_id})`,
      });
    }

    return {
      transaction,
      invoice,
      refunds: refRes.rows,
      timeline,
    };
  },

  // =========================================================================
  // 7. Billing Dashboard Metrics (All cards clickable + Revenue formulas)
  // =========================================================================
  async getDashboardMetrics(): Promise<{
    todayRevenue: number;
    monthRevenue: number;
    todayRechargesCount: number;
    monthRechargesCount: number;
    activeSubscribers: number;
    expiringTodayCount: number;
    expiringSoonCount: number;
    expiredSubscribersCount: number;
    pendingTransactionsCount: number;
    refundsAmount: number;
    grossRevenue: number;
    totalDiscounts: number;
    totalRefunds: number;
    netRevenue: number;
    recentTransactions: BillingTransactionRecord[];
  }> {
    // Today's completed transactions
    const todayRes = await query<{ revenue: string; count: string; discounts: string }>(
      `SELECT COALESCE(SUM(final_amount), 0) as revenue,
              count(*) as count,
              COALESCE(SUM(discount_amount), 0) as discounts
         FROM recharge_transactions
        WHERE status = 'COMPLETED'
          AND recharge_date >= CURRENT_DATE`,
    );

    // This month's completed transactions
    const monthRes = await query<{ revenue: string; count: string; discounts: string }>(
      `SELECT COALESCE(SUM(final_amount), 0) as revenue,
              count(*) as count,
              COALESCE(SUM(discount_amount), 0) as discounts
         FROM recharge_transactions
        WHERE status = 'COMPLETED'
          AND recharge_date >= date_trunc('month', CURRENT_DATE)`,
    );

    // All-time Gross Revenue, Discounts, Refunds
    const grossRes = await query<{ gross: string; discounts: string }>(
      `SELECT COALESCE(SUM(original_price), 0) as gross,
              COALESCE(SUM(discount_amount), 0) as discounts
         FROM recharge_transactions
        WHERE status IN ('COMPLETED', 'REFUNDED', 'PARTIALLY_REFUNDED')`,
    );

    const refundsRes = await query<{ total_refunds: string }>(
      `SELECT COALESCE(SUM(amount), 0) as total_refunds FROM refunds`,
    );

    // Subscriber status counts
    const activeSubRes = await query<{ count: string }>(
      `SELECT count(*) as count FROM subscribers WHERE status = 'active' AND (expiry_date IS NULL OR expiry_date >= NOW())`,
    );
    const expiringTodayRes = await query<{ count: string }>(
      `SELECT count(*) as count FROM subscribers WHERE expiry_date >= CURRENT_DATE AND expiry_date < CURRENT_DATE + INTERVAL '1 day'`,
    );
    const expiringSoonRes = await query<{ count: string }>(
      `SELECT count(*) as count FROM subscribers WHERE expiry_date >= CURRENT_DATE AND expiry_date < CURRENT_DATE + INTERVAL '7 days'`,
    );
    const expiredSubRes = await query<{ count: string }>(
      `SELECT count(*) as count FROM subscribers WHERE status = 'expired' OR (expiry_date IS NOT NULL AND expiry_date < NOW())`,
    );

    // Pending transactions
    const pendingRes = await query<{ count: string }>(
      `SELECT count(*) as count FROM recharge_transactions WHERE status = 'PENDING'`,
    );

    // Recent transactions
    const recentRes = await query<BillingTransactionRecord>(
      `SELECT * FROM recharge_transactions ORDER BY recharge_date DESC LIMIT 10`,
    );

    const gross = Number(grossRes.rows[0]?.gross || '0');
    const discounts = Number(grossRes.rows[0]?.discounts || '0');
    const refunds = Number(refundsRes.rows[0]?.total_refunds || '0');
    const netRevenue = Math.max(0, gross - discounts - refunds);

    return {
      todayRevenue: Number(todayRes.rows[0]?.revenue || '0'),
      monthRevenue: Number(monthRes.rows[0]?.revenue || '0'),
      todayRechargesCount: Number(todayRes.rows[0]?.count || '0'),
      monthRechargesCount: Number(monthRes.rows[0]?.count || '0'),
      activeSubscribers: Number(activeSubRes.rows[0]?.count || '0'),
      expiringTodayCount: Number(expiringTodayRes.rows[0]?.count || '0'),
      expiringSoonCount: Number(expiringSoonRes.rows[0]?.count || '0'),
      expiredSubscribersCount: Number(expiredSubRes.rows[0]?.count || '0'),
      pendingTransactionsCount: Number(pendingRes.rows[0]?.count || '0'),
      refundsAmount: refunds,
      grossRevenue: gross,
      totalDiscounts: discounts,
      totalRefunds: refunds,
      netRevenue,
      recentTransactions: recentRes.rows,
    };
  },

  // =========================================================================
  // 8. Expiry Management Filter View
  // =========================================================================
  async getExpiringSubscribers(options: {
    filter: 'today' | 'tomorrow' | '3days' | '7days' | 'expired' | 'all';
    packageId?: number;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: any[]; total: number }> {
    const { filter, packageId, search, limit = 50, offset = 0 } = options;
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filter === 'today') {
      conditions.push(`s.expiry_date >= CURRENT_DATE AND s.expiry_date < CURRENT_DATE + INTERVAL '1 day'`);
    } else if (filter === 'tomorrow') {
      conditions.push(`s.expiry_date >= CURRENT_DATE + INTERVAL '1 day' AND s.expiry_date < CURRENT_DATE + INTERVAL '2 days'`);
    } else if (filter === '3days') {
      conditions.push(`s.expiry_date >= CURRENT_DATE AND s.expiry_date < CURRENT_DATE + INTERVAL '3 days'`);
    } else if (filter === '7days') {
      conditions.push(`s.expiry_date >= CURRENT_DATE AND s.expiry_date < CURRENT_DATE + INTERVAL '7 days'`);
    } else if (filter === 'expired') {
      conditions.push(`(s.status = 'expired' OR (s.expiry_date IS NOT NULL AND s.expiry_date < NOW()))`);
    }

    if (packageId) {
      conditions.push(`s.current_package_id = $${idx++}`);
      values.push(packageId);
    }
    if (search && search.trim()) {
      conditions.push(`(s.username ILIKE $${idx} OR s.customer_id ILIKE $${idx} OR s.full_name ILIKE $${idx})`);
      values.push(`%${search.trim()}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query<{ count: string }>(
      `SELECT count(*) as count FROM subscribers s ${where}`,
      values,
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const listSql = `
      SELECT s.id, s.username, s.customer_id, s.full_name, s.email, s.phone,
             s.status, s.expiry_date, s.current_package_id, p.name as package_name,
             p.download_speed_mbps, p.upload_speed_mbps, p.price as package_price
        FROM subscribers s
   LEFT JOIN packages p ON p.id = s.current_package_id
       ${where}
       ORDER BY s.expiry_date ASC NULLS LAST
       LIMIT $${idx++} OFFSET $${idx++}
    `;
    values.push(limit, offset);

    const { rows } = await query(listSql, values);
    return { items: rows, total };
  },

  // =========================================================================
  // 9. Financial Reports
  // =========================================================================
  async getFinancialReports(options: {
    reportType: 'daily' | 'monthly' | 'packages' | 'methods' | 'discounts' | 'refunds' | 'adjustments';
    dateFrom?: string;
    dateTo?: string;
    packageId?: number;
    paymentMethod?: string;
  }): Promise<any> {
    const { reportType, dateFrom, dateTo, packageId, paymentMethod } = options;
    const pkgClause = packageId ? `AND rt.package_id = ${Number(packageId)}` : '';
    const methodClause = paymentMethod ? `AND rt.payment_method = '${paymentMethod.replace(/'/g, "''")}'` : '';

    if (reportType === 'daily') {
      const { rows } = await query(
        `SELECT to_char(recharge_date, 'YYYY-MM-DD') as day,
                count(*) as transactions_count,
                COALESCE(SUM(original_price), 0) as gross_revenue,
                COALESCE(SUM(discount_amount), 0) as total_discounts,
                COALESCE(SUM(final_amount), 0) as net_revenue
           FROM recharge_transactions rt
          WHERE rt.status = 'COMPLETED'
            ${dateFrom ? `AND rt.recharge_date >= '${dateFrom}'` : `AND rt.recharge_date >= CURRENT_DATE - INTERVAL '30 days'`}
            ${dateTo ? `AND rt.recharge_date <= '${dateTo}'` : ''}
            ${pkgClause}
            ${methodClause}
          GROUP BY 1
          ORDER BY 1 DESC`,
      );
      return rows;
    }

    if (reportType === 'monthly') {
      const { rows } = await query(
        `SELECT to_char(recharge_date, 'YYYY-MM') as month,
                count(*) as transactions_count,
                COALESCE(SUM(original_price), 0) as gross_revenue,
                COALESCE(SUM(discount_amount), 0) as total_discounts,
                COALESCE(SUM(final_amount), 0) as net_revenue
           FROM recharge_transactions rt
          WHERE rt.status = 'COMPLETED'
            ${dateFrom ? `AND rt.recharge_date >= '${dateFrom}'` : `AND rt.recharge_date >= CURRENT_DATE - INTERVAL '12 months'`}
            ${dateTo ? `AND rt.recharge_date <= '${dateTo}'` : ''}
            ${pkgClause}
            ${methodClause}
          GROUP BY 1
          ORDER BY 1 DESC`,
      );
      return rows;
    }

    if (reportType === 'packages') {
      const { rows } = await query(
        `SELECT p.name as package_name,
                count(rt.id) as transactions_count,
                COALESCE(SUM(rt.final_amount), 0) as total_revenue
           FROM recharge_transactions rt
           JOIN packages p ON p.id = rt.package_id
          WHERE rt.status = 'COMPLETED'
            ${dateFrom ? `AND rt.recharge_date >= '${dateFrom}'` : ''}
            ${dateTo ? `AND rt.recharge_date <= '${dateTo}'` : ''}
            ${pkgClause}
            ${methodClause}
          GROUP BY p.name
          ORDER BY total_revenue DESC`,
      );
      return rows;
    }

    if (reportType === 'methods') {
      const { rows } = await query(
        `SELECT payment_method,
                count(*) as count,
                COALESCE(SUM(final_amount), 0) as total_amount
           FROM recharge_transactions rt
          WHERE rt.status = 'COMPLETED'
            ${dateFrom ? `AND rt.recharge_date >= '${dateFrom}'` : ''}
            ${dateTo ? `AND rt.recharge_date <= '${dateTo}'` : ''}
            ${pkgClause}
            ${methodClause}
          GROUP BY payment_method
          ORDER BY total_amount DESC`,
      );
      return rows;
    }

    if (reportType === 'discounts') {
      const { rows } = await query(
        `SELECT transaction_id, username, customer_id, package_name,
                original_price, discount_type, discount_value, discount_amount,
                final_amount, created_by, recharge_date
           FROM recharge_transactions rt
          WHERE rt.discount_amount > 0
            ${dateFrom ? `AND rt.recharge_date >= '${dateFrom}'` : ''}
            ${dateTo ? `AND rt.recharge_date <= '${dateTo}'` : ''}
            ${pkgClause}
            ${methodClause}
          ORDER BY rt.recharge_date DESC
          LIMIT 100`,
      );
      return rows;
    }

    if (reportType === 'refunds') {
      const { rows } = await query(
        `SELECT r.refund_id, r.transaction_id, s.username, s.customer_id,
                r.amount, r.currency, r.refund_type, r.reason, r.refund_method,
                r.processed_by, r.created_at
           FROM refunds r
           JOIN subscribers s ON s.id = r.subscriber_id
          ORDER BY r.created_at DESC
          LIMIT 100`,
      );
      return rows;
    }

    if (reportType === 'adjustments') {
      const { rows } = await query(
        `SELECT a.adjustment_id, s.username, s.customer_id, a.adjustment_type,
                a.amount, a.days, a.reason, a.operator_username, a.created_at
           FROM billing_adjustments a
           JOIN subscribers s ON s.id = a.subscriber_id
          ORDER BY a.created_at DESC
          LIMIT 100`,
      );
      return rows;
    }

    return [];
  },

  // =========================================================================
  // 10. Global Billing Search
  // =========================================================================
  async searchBilling(q: string): Promise<any[]> {
    if (!q || q.trim().length < 2) return [];
    const term = `%${q.trim()}%`;
    const { rows } = await query(
      `SELECT 'transaction' as type, rt.transaction_id as id,
              rt.transaction_id || ' — ' || rt.username || ' (' || rt.currency || ' ' || rt.final_amount || ')' as title,
              'Recharge: ' || rt.package_name || ' • ' || rt.payment_method as subtitle,
              rt.status as badge,
              rt.transaction_id as ref
         FROM recharge_transactions rt
        WHERE rt.transaction_id ILIKE $1
           OR rt.username ILIKE $1
           OR rt.customer_id ILIKE $1
           OR rt.payment_reference ILIKE $1
        UNION ALL
       SELECT 'invoice' as type, inv.invoice_no as id,
              inv.invoice_no || ' — ' || inv.username || ' (' || inv.currency || ' ' || inv.total_amount || ')' as title,
              'Invoice for ' || inv.package_name as subtitle,
              inv.status as badge,
              inv.transaction_id as ref
         FROM invoices inv
        WHERE inv.invoice_no ILIKE $1
           OR inv.customer_name ILIKE $1
           OR inv.username ILIKE $1
        LIMIT 20`,
      [term],
    );
    return rows;
  },

  // Invoices
  async listInvoices(subscriberId?: number, limit = 50, offset = 0): Promise<{ items: InvoiceRecord[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (subscriberId) {
      conditions.push(`subscriber_id = $${idx++}`);
      values.push(subscriberId);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query<{ count: string }>(`SELECT count(*) as count FROM invoices ${where}`, values);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    values.push(limit, offset);
    const { rows } = await query<InvoiceRecord>(
      `SELECT * FROM invoices ${where} ORDER BY issue_date DESC LIMIT $${idx++} OFFSET $${idx++}`,
      values,
    );
    return { items: rows, total };
  },

  async getInvoiceByNo(invoiceNo: string): Promise<InvoiceRecord | null> {
    const { rows } = await query<InvoiceRecord>(
      `SELECT * FROM invoices WHERE invoice_no = $1`,
      [invoiceNo],
    );
    return rows[0] || null;
  },
};
