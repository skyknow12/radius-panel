import { query } from '../db/pool';
import { subscriberRepository } from './subscriber.repository';
import { auditRepository } from './audit.repository';
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

export interface RechargeTransactionRecord {
  id: number;
  receipt_no: string;
  subscriber_id: number;
  username: string;
  customer_id: string;
  full_name: string;
  package_id: number;
  package_name: string;
  duration_months: number;
  amount: string;
  currency: string;
  payment_method: string;
  recharge_date: Date;
  previous_expiry: Date | null;
  new_expiry: Date;
  created_by: string;
  notes: string | null;
  created_at: Date;
}

export interface CreateRechargeInput {
  subscriber_id: number;
  package_id: number;
  duration_months: number;
  amount: number;
  currency?: string;
  payment_method?: string;
  created_by?: string;
  notes?: string;
}

export const rechargeRepository = {
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
  ): Promise<PackagePriceRecord> {
    const { rows } = await query<PackagePriceRecord>(
      `INSERT INTO package_prices (package_id, duration_months, price, currency, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (package_id, duration_months)
       DO UPDATE SET price = EXCLUDED.price, currency = EXCLUDED.currency, is_active = TRUE, updated_at = NOW()
       RETURNING id, package_id, duration_months, price, currency, is_active, created_at, updated_at`,
      [packageId, durationMonths, price, currency],
    );
    return rows[0];
  },

  async listTransactions(
    options: { subscriberId?: number; limit?: number; offset?: number } = {},
  ): Promise<{ items: RechargeTransactionRecord[]; total: number }> {
    const { subscriberId, limit = 50, offset = 0 } = options;
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (subscriberId) {
      conditions.push(`rt.subscriber_id = $${idx++}`);
      values.push(subscriberId);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query<{ count: string }>(
      `SELECT count(*) as count FROM recharge_transactions rt ${whereClause}`,
      values,
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const listSql = `
      SELECT rt.id, rt.receipt_no, rt.subscriber_id, s.username, s.customer_id, s.full_name,
             rt.package_id, p.name AS package_name, rt.duration_months, rt.amount, rt.currency,
             rt.payment_method, rt.recharge_date, rt.previous_expiry, rt.new_expiry,
             rt.created_by, rt.notes, rt.created_at
        FROM recharge_transactions rt
        JOIN subscribers s ON s.id = rt.subscriber_id
        JOIN packages p ON p.id = rt.package_id
       ${whereClause}
       ORDER BY rt.recharge_date DESC
       LIMIT $${idx++} OFFSET $${idx++}
    `;
    values.push(limit, offset);

    const { rows } = await query<RechargeTransactionRecord>(listSql, values);
    return { items: rows, total };
  },

  async processRecharge(input: CreateRechargeInput): Promise<RechargeTransactionRecord> {
    const { subscriber_id, package_id, duration_months, amount, currency = 'NPR', payment_method = 'Cash', created_by = 'admin', notes } = input;

    const subscriber = await subscriberRepository.findById(subscriber_id);
    if (!subscriber) {
      throw HttpError.notFound('Subscriber not found');
    }

    // 1. Calculate new expiry date
    const now = new Date();
    let baseDate = now;
    if (subscriber.expiry_date && new Date(subscriber.expiry_date) > now) {
      baseDate = new Date(subscriber.expiry_date);
    }
    const newExpiry = new Date(baseDate);
    newExpiry.setMonth(newExpiry.getMonth() + duration_months);

    // 2. Generate unique receipt number: REC-YYYYMMDD-XXXX
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    const receiptNo = `REC-${dateStr}-${randomHex}`;

    // 3. Insert recharge transaction
    const { rows: txRows } = await query<RechargeTransactionRecord>(
      `INSERT INTO recharge_transactions (
         receipt_no, subscriber_id, package_id, duration_months,
         amount, currency, payment_method, recharge_date, previous_expiry,
         new_expiry, created_by, notes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, $11)
       RETURNING id, receipt_no, subscriber_id, package_id, duration_months,
                 amount, currency, payment_method, recharge_date, previous_expiry,
                 new_expiry, created_by, notes, created_at`,
      [
        receiptNo,
        subscriber_id,
        package_id,
        duration_months,
        amount,
        currency,
        payment_method,
        subscriber.expiry_date,
        newExpiry,
        created_by,
        notes,
      ],
    );
    const tx = txRows[0];

    // 4. Update subscriber expiry date, package and status to 'active'
    await query(
      `UPDATE subscribers
          SET current_package_id = $1,
              expiry_date = $2,
              status = 'active',
              updated_at = NOW()
        WHERE id = $3`,
      [package_id, newExpiry, subscriber_id],
    );

    // Update radcheck Cleartext-Password & Expiration
    await query(
      `UPDATE radcheck
          SET value = to_char($1::timestamptz, 'DD Mon YYYY 23:59:59')
        WHERE lower(username) = lower($2) AND attribute = 'Expiration'`,
      [newExpiry, subscriber.username],
    );
    // Remove any Auth-Type := Reject that was set on expiry
    await query(
      `DELETE FROM radcheck
        WHERE lower(username) = lower($1) AND attribute = 'Auth-Type' AND value = 'Reject'`,
      [subscriber.username],
    );

    // 5. Create new subscriber_services record
    const serviceId = `SRV-${subscriber.customer_id}-${randomHex}`;
    await query(
      `INSERT INTO subscriber_services (
         service_id, subscriber_id, package_id, start_date, expiry_date, status, created_by, notes
       ) VALUES ($1, $2, $3, NOW(), $4, 'active', $5, $6)`,
      [serviceId, subscriber_id, package_id, newExpiry, created_by, `Recharge: ${duration_months} Months (${receiptNo})`],
    );

    // 6. Record subscriber activity and network event
    await query(
      `INSERT INTO subscriber_activity (subscriber_id, action, details, admin_username)
       VALUES ($1, 'recharge.completed', $2, $3)`,
      [
        subscriber_id,
        `Recharge of ${currency} ${amount} for ${duration_months} month(s). New expiry: ${newExpiry.toISOString().slice(0, 10)}. Receipt: ${receiptNo}`,
        created_by,
      ],
    );

    await query(
      `INSERT INTO network_events (event_type, severity, actor, target, description, metadata)
       VALUES ('recharge.completed', 'info', $1, $2, $3, $4)`,
      [
        created_by,
        subscriber.username,
        `Subscriber ${subscriber.username} recharged for ${duration_months} month(s) (${receiptNo})`,
        JSON.stringify({ receiptNo, amount, currency, duration_months, newExpiry }),
      ],
    );

    return tx;
  },
};
