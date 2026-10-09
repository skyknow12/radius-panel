import bcrypt from 'bcryptjs';
import { query, getClient } from '../db/pool';
import { HttpError } from '../lib/http-error';
import { auditRepository } from '../repositories/audit.repository';

export interface OrganizationItem {
  id: number;
  name: string;
  code: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  currency: string;
  timezone: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface BranchItem {
  id: number;
  organization_id: number;
  name: string;
  code: string;
  address: string | null;
  contact_number: string | null;
  email: string | null;
  manager_name: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  notes: string | null;
  wallet_id?: number | null;
  wallet_balance?: number;
  credit_limit?: number;
  subscriber_count?: number;
  active_subscribers?: number;
  created_at: string;
  updated_at: string;
}

export interface ResellerItem {
  id: number;
  organization_id: number;
  branch_id: number | null;
  branch_name?: string | null;
  name: string;
  code: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  commission_model: 'discount' | 'commission';
  commission_percent?: number;
  credit_status?: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
  notes: string | null;
  wallet_id?: number | null;
  wallet_balance?: number;
  credit_limit?: number;
  used_credit?: number;
  customer_count?: number;
  active_customers?: number;
  created_at: string;
  updated_at: string;
}

export interface WalletItem {
  id: number;
  wallet_number: string;
  entity_type: 'branch' | 'reseller';
  branch_id: number | null;
  reseller_id: number | null;
  entity_name?: string;
  entity_code?: string;
  balance: number;
  total_topup: number;
  total_used: number;
  total_refund: number;
  total_adjusted: number;
  currency: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'LOCKED';
  credit_enabled?: boolean;
  credit_limit?: number;
  used_credit?: number;
  remaining_credit?: number;
  total_available?: number;
  credit_status?: string;
  credit_expiry?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WalletTransactionItem {
  id: number;
  transaction_id: string;
  wallet_id: number;
  wallet_number?: string;
  entity_name?: string;
  entity_type?: string;
  type: 'TOP_UP' | 'DEBIT' | 'CREDIT' | 'REFUND' | 'ADJUSTMENT' | 'REVERSAL';
  amount: number;
  balance_before: number;
  balance_after: number;
  credit_used_before: number;
  credit_used_after: number;
  reference: string | null;
  payment_method: string | null;
  reason: string | null;
  idempotency_key?: string | null;
  created_by: string;
  created_at: string;
}

export interface ChannelPricingRuleItem {
  id: number;
  rule_name: string;
  channel_type: 'branch' | 'reseller';
  branch_id: number | null;
  branch_name?: string | null;
  reseller_id: number | null;
  reseller_name?: string | null;
  package_id: number | null;
  package_name?: string | null;
  duration_months: number | null;
  rule_type: 'percentage_discount' | 'percentage_commission' | 'fixed_discount' | 'fixed_override';
  value: number;
  is_active: boolean;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OwnershipHistoryItem {
  id: number;
  subscriber_id: number;
  username?: string;
  previous_ownership_type: string;
  previous_branch_name?: string | null;
  previous_reseller_name?: string | null;
  new_ownership_type: string;
  new_branch_name?: string | null;
  new_reseller_name?: string | null;
  changed_by: string;
  reason: string | null;
  created_at: string;
}

export const organizationRepository = {
  // ===========================================================================
  // 1. Organization Management
  // ===========================================================================
  async getPrimaryOrganization(): Promise<OrganizationItem> {
    const { rows } = await query<OrganizationItem>(
      `SELECT id, name, code, logo_url, address, phone, email, website,
              currency, timezone, status, settings, created_at, updated_at
         FROM organizations
        ORDER BY id ASC LIMIT 1`
    );
    if (!rows[0]) {
      throw HttpError.notFound('Organization record not found');
    }
    return rows[0];
  },

  async updateOrganization(id: number, input: Partial<OrganizationItem>): Promise<OrganizationItem> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
    if (input.logo_url !== undefined) { fields.push(`logo_url = $${idx++}`); values.push(input.logo_url); }
    if (input.address !== undefined) { fields.push(`address = $${idx++}`); values.push(input.address); }
    if (input.phone !== undefined) { fields.push(`phone = $${idx++}`); values.push(input.phone); }
    if (input.email !== undefined) { fields.push(`email = $${idx++}`); values.push(input.email); }
    if (input.website !== undefined) { fields.push(`website = $${idx++}`); values.push(input.website); }
    if (input.currency !== undefined) { fields.push(`currency = $${idx++}`); values.push(input.currency); }
    if (input.timezone !== undefined) { fields.push(`timezone = $${idx++}`); values.push(input.timezone); }
    if (input.status !== undefined) { fields.push(`status = $${idx++}`); values.push(input.status); }
    if (input.settings !== undefined) { fields.push(`settings = $${idx++}`); values.push(JSON.stringify(input.settings)); }

    if (fields.length === 0) {
      return this.getPrimaryOrganization();
    }

    values.push(id);
    const sql = `UPDATE organizations SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const { rows } = await query<OrganizationItem>(sql, values);
    return rows[0];
  },

  async getOrganizationDashboardMetrics() {
    const [branchesRes, resellersRes, subsRes, onlineRes, finRes, wltRes] = await Promise.all([
      query<{ count: string; active: string }>(`SELECT COUNT(*) AS count, COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active FROM branches`),
      query<{ count: string; active: string }>(`SELECT COUNT(*) AS count, COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active FROM resellers`),
      query<{ total: string; active: string; expired: string }>(`
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE status = 'enabled' AND (expiry_date IS NULL OR expiry_date > NOW())) AS active,
               COUNT(*) FILTER (WHERE expiry_date <= NOW()) AS expired
          FROM subscribers
      `),
      query<{ count: string }>(`SELECT COUNT(*) AS count FROM radacct WHERE acctstoptime IS NULL`),
      query<{
        today_recharge: string;
        monthly_recharge: string;
        monthly_revenue: string;
        total_commission: string;
      }>(`
        SELECT
          COALESCE(SUM(final_amount) FILTER (WHERE recharge_date >= CURRENT_DATE), 0) AS today_recharge,
          COALESCE(SUM(final_amount) FILTER (WHERE recharge_date >= date_trunc('month', CURRENT_DATE)), 0) AS monthly_recharge,
          COALESCE(SUM(final_amount) FILTER (WHERE recharge_date >= date_trunc('month', CURRENT_DATE) AND status = 'COMPLETED'), 0) AS monthly_revenue,
          COALESCE(SUM(commission_amount) FILTER (WHERE recharge_date >= date_trunc('month', CURRENT_DATE)), 0) AS total_commission
        FROM recharge_transactions
      `),
      query<{
        total_balance: string;
        total_credit: string;
        used_credit: string;
      }>(`
        SELECT
          COALESCE(SUM(w.balance), 0) AS total_balance,
          COALESCE(SUM(c.credit_limit) FILTER (WHERE c.credit_enabled = TRUE AND c.status = 'ACTIVE'), 0) AS total_credit,
          COALESCE(SUM(c.used_credit) FILTER (WHERE c.credit_enabled = TRUE), 0) AS used_credit
        FROM wallets w
        LEFT JOIN credit_accounts c ON c.wallet_id = w.id
      `),
    ]);

    return {
      totalBranches: Number(branchesRes.rows[0]?.count || 0),
      activeBranches: Number(branchesRes.rows[0]?.active || 0),
      totalResellers: Number(resellersRes.rows[0]?.count || 0),
      activeResellers: Number(resellersRes.rows[0]?.active || 0),
      totalSubscribers: Number(subsRes.rows[0]?.total || 0),
      activeSubscribers: Number(subsRes.rows[0]?.active || 0),
      expiredSubscribers: Number(subsRes.rows[0]?.expired || 0),
      onlineUsers: Number(onlineRes.rows[0]?.count || 0),
      todayRecharge: Number(finRes.rows[0]?.today_recharge || 0),
      monthlyRecharge: Number(finRes.rows[0]?.monthly_recharge || 0),
      monthlyRevenue: Number(finRes.rows[0]?.monthly_revenue || 0),
      monthlyCommission: Number(finRes.rows[0]?.total_commission || 0),
      walletBalance: Number(wltRes.rows[0]?.total_balance || 0),
      totalCredit: Number(wltRes.rows[0]?.total_credit || 0),
      usedCredit: Number(wltRes.rows[0]?.used_credit || 0),
      availableCredit: Math.max(0, Number(wltRes.rows[0]?.total_credit || 0) - Number(wltRes.rows[0]?.used_credit || 0)),
    };
  },

  // ===========================================================================
  // 2. Branch Management
  // ===========================================================================
  async listBranches(): Promise<BranchItem[]> {
    const { rows } = await query<BranchItem>(`
      SELECT b.id, b.organization_id, b.name, b.code, b.address, b.contact_number,
             b.email, b.manager_name, b.status, b.notes, b.created_at, b.updated_at,
             w.id AS wallet_id,
             COALESCE(w.balance, 0)::float AS wallet_balance,
             COALESCE(c.credit_limit, 0)::float AS credit_limit,
             COUNT(s.id)::int AS subscriber_count,
             COUNT(s.id) FILTER (WHERE s.status = 'enabled' AND (s.expiry_date IS NULL OR s.expiry_date > NOW()))::int AS active_subscribers
        FROM branches b
        LEFT JOIN wallets w ON w.branch_id = b.id
        LEFT JOIN credit_accounts c ON c.wallet_id = w.id
        LEFT JOIN subscribers s ON s.branch_id = b.id
       GROUP BY b.id, w.id, w.balance, c.credit_limit
       ORDER BY b.name ASC
    `);
    return rows;
  },

  async getBranch(id: number): Promise<BranchItem | null> {
    const { rows } = await query<BranchItem>(`
      SELECT b.id, b.organization_id, b.name, b.code, b.address, b.contact_number,
             b.email, b.manager_name, b.status, b.notes, b.created_at, b.updated_at,
             w.id AS wallet_id,
             COALESCE(w.balance, 0)::float AS wallet_balance,
             COALESCE(c.credit_limit, 0)::float AS credit_limit,
             COUNT(s.id)::int AS subscriber_count,
             COUNT(s.id) FILTER (WHERE s.status = 'enabled' AND (s.expiry_date IS NULL OR s.expiry_date > NOW()))::int AS active_subscribers
        FROM branches b
        LEFT JOIN wallets w ON w.branch_id = b.id
        LEFT JOIN credit_accounts c ON c.wallet_id = w.id
        LEFT JOIN subscribers s ON s.branch_id = b.id
       WHERE b.id = $1
       GROUP BY b.id, w.id, w.balance, c.credit_limit
    `, [id]);
    return rows[0] ?? null;
  },

  async createBranch(input: {
    name: string;
    code: string;
    address?: string | null;
    contact_number?: string | null;
    email?: string | null;
    manager_name?: string | null;
    status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    notes?: string | null;
  }): Promise<BranchItem> {
    const org = await this.getPrimaryOrganization();
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<BranchItem>(`
        INSERT INTO branches (organization_id, name, code, address, contact_number, email, manager_name, status, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        org.id,
        input.name,
        input.code.toUpperCase(),
        input.address || null,
        input.contact_number || null,
        input.email || null,
        input.manager_name || null,
        input.status || 'ACTIVE',
        input.notes || null,
      ]);
      const branch = rows[0];

      // Auto-provision branch wallet
      const walletNumber = `WLT-BRN-${branch.code.toUpperCase()}`;
      const walletRes = await client.query<{ id: number }>(`
        INSERT INTO wallets (wallet_number, entity_type, branch_id, balance, total_topup, total_used, status)
        VALUES ($1, 'branch', $2, 0.00, 0.00, 0.00, 'ACTIVE')
        RETURNING id
      `, [walletNumber, branch.id]);

      // Auto-provision credit account
      await client.query(`
        INSERT INTO credit_accounts (wallet_id, credit_enabled, credit_limit, used_credit, status)
        VALUES ($1, FALSE, 0.00, 0.00, 'ACTIVE')
      `, [walletRes.rows[0].id]);

      await client.query('COMMIT');
      return (await this.getBranch(branch.id))!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async updateBranch(id: number, input: Partial<BranchItem>): Promise<BranchItem> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
    if (input.code !== undefined) { fields.push(`code = $${idx++}`); values.push(input.code.toUpperCase()); }
    if (input.address !== undefined) { fields.push(`address = $${idx++}`); values.push(input.address); }
    if (input.contact_number !== undefined) { fields.push(`contact_number = $${idx++}`); values.push(input.contact_number); }
    if (input.email !== undefined) { fields.push(`email = $${idx++}`); values.push(input.email); }
    if (input.manager_name !== undefined) { fields.push(`manager_name = $${idx++}`); values.push(input.manager_name); }
    if (input.status !== undefined) { fields.push(`status = $${idx++}`); values.push(input.status); }
    if (input.notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(input.notes); }

    if (fields.length > 0) {
      values.push(id);
      await query(`UPDATE branches SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    }
    const updated = await this.getBranch(id);
    if (!updated) throw HttpError.notFound('Branch not found');
    return updated;
  },

  async getBranchDashboardMetrics(branchId: number) {
    const [subRes, finRes, wltRes, recentTxRes] = await Promise.all([
      query<{ total: string; active: string; expired: string }>(`
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE status = 'enabled' AND (expiry_date IS NULL OR expiry_date > NOW())) AS active,
               COUNT(*) FILTER (WHERE expiry_date <= NOW()) AS expired
          FROM subscribers
         WHERE branch_id = $1
      `, [branchId]),
      query<{ today_recharge: string; monthly_revenue: string }>(`
        SELECT
          COALESCE(SUM(final_amount) FILTER (WHERE recharge_date >= CURRENT_DATE), 0) AS today_recharge,
          COALESCE(SUM(final_amount) FILTER (WHERE recharge_date >= date_trunc('month', CURRENT_DATE)), 0) AS monthly_revenue
        FROM recharge_transactions
        WHERE branch_id = $1
      `, [branchId]),
      query<{
        balance: string;
        credit_limit: string;
        used_credit: string;
        credit_enabled: boolean;
      }>(`
        SELECT w.balance, COALESCE(c.credit_limit, 0) AS credit_limit,
               COALESCE(c.used_credit, 0) AS used_credit,
               COALESCE(c.credit_enabled, false) AS credit_enabled
          FROM wallets w
          LEFT JOIN credit_accounts c ON c.wallet_id = w.id
         WHERE w.branch_id = $1
      `, [branchId]),
      query<any>(`
        SELECT id, transaction_id, username, full_name, package_name, duration,
               final_amount, payment_method, recharge_date, status
          FROM recharge_transactions
         WHERE branch_id = $1
         ORDER BY recharge_date DESC LIMIT 10
      `, [branchId]),
    ]);

    const w = wltRes.rows[0];
    const balance = Number(w?.balance || 0);
    const creditLimit = Number(w?.credit_limit || 0);
    const usedCredit = Number(w?.used_credit || 0);
    const remainingCredit = Math.max(0, creditLimit - usedCredit);

    return {
      subscribers: Number(subRes.rows[0]?.total || 0),
      activeSubscribers: Number(subRes.rows[0]?.active || 0),
      expiredSubscribers: Number(subRes.rows[0]?.expired || 0),
      todayRecharge: Number(finRes.rows[0]?.today_recharge || 0),
      monthlyRevenue: Number(finRes.rows[0]?.monthly_revenue || 0),
      walletBalance: balance,
      creditLimit: creditLimit,
      usedCredit: usedCredit,
      remainingCredit: remainingCredit,
      totalAvailable: balance + (w?.credit_enabled ? remainingCredit : 0),
      recentTransactions: recentTxRes.rows,
    };
  },

  // ===========================================================================
  // 3. Reseller Management
  // ===========================================================================
  async listResellers(branchId?: number): Promise<ResellerItem[]> {
    const params: any[] = [];
    let filter = '';
    if (branchId) {
      params.push(branchId);
      filter = 'WHERE r.branch_id = $1';
    }

    const { rows } = await query<ResellerItem>(`
      SELECT r.id, r.organization_id, r.branch_id, b.name AS branch_name,
             r.name, r.code, r.contact_person, r.phone, r.email, r.address,
             r.status, r.commission_model,
             COALESCE(r.commission_percent, 50.00)::float AS commission_percent,
             COALESCE(r.credit_status, 'ACTIVE') AS credit_status,
             r.notes, r.created_at, r.updated_at,
             w.id AS wallet_id,
             COALESCE(w.balance, 0)::float AS wallet_balance,
             COALESCE(r.credit_limit, c.credit_limit, 0)::float AS credit_limit,
             COALESCE(r.credit_used, c.used_credit, 0)::float AS used_credit,
             COUNT(s.id)::int AS customer_count,
             COUNT(s.id) FILTER (WHERE s.status = 'enabled' AND (s.expiry_date IS NULL OR s.expiry_date > NOW()))::int AS active_customers
        FROM resellers r
        LEFT JOIN branches b ON b.id = r.branch_id
        LEFT JOIN wallets w ON w.reseller_id = r.id
        LEFT JOIN credit_accounts c ON c.wallet_id = w.id
        LEFT JOIN subscribers s ON s.reseller_id = r.id
       ${filter}
       GROUP BY r.id, b.name, w.id, w.balance, r.credit_limit, c.credit_limit, r.credit_used, c.used_credit, r.commission_percent, r.credit_status
       ORDER BY r.name ASC
    `, params);
    return rows;
  },

  async getReseller(id: number): Promise<ResellerItem | null> {
    const { rows } = await query<ResellerItem>(`
      SELECT r.id, r.organization_id, r.branch_id, b.name AS branch_name,
             r.name, r.code, r.contact_person, r.phone, r.email, r.address,
             r.status, r.commission_model,
             COALESCE(r.commission_percent, 50.00)::float AS commission_percent,
             COALESCE(r.credit_status, 'ACTIVE') AS credit_status,
             r.notes, r.created_at, r.updated_at,
             w.id AS wallet_id,
             COALESCE(w.balance, 0)::float AS wallet_balance,
             COALESCE(r.credit_limit, c.credit_limit, 0)::float AS credit_limit,
             COALESCE(r.credit_used, c.used_credit, 0)::float AS used_credit,
             COUNT(s.id)::int AS customer_count,
             COUNT(s.id) FILTER (WHERE s.status = 'enabled' AND (s.expiry_date IS NULL OR s.expiry_date > NOW()))::int AS active_customers
        FROM resellers r
        LEFT JOIN branches b ON b.id = r.branch_id
        LEFT JOIN wallets w ON w.reseller_id = r.id
        LEFT JOIN credit_accounts c ON c.wallet_id = w.id
        LEFT JOIN subscribers s ON s.reseller_id = r.id
       WHERE r.id = $1
       GROUP BY r.id, b.name, w.id, w.balance, r.credit_limit, c.credit_limit, r.credit_used, c.used_credit, r.commission_percent, r.credit_status
    `, [id]);
    return rows[0] ?? null;
  },

  async createReseller(input: {
    branch_id?: number | null;
    name: string;
    code: string;
    contact_person?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    commission_model?: 'discount' | 'commission';
    commission_percent?: number;
    credit_limit?: number;
    credit_status?: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
    notes?: string | null;
    login_username?: string | null;
    login_password?: string | null;
  }): Promise<ResellerItem> {
    const org = await this.getPrimaryOrganization();
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const commPercent = input.commission_percent !== undefined ? input.commission_percent : 50.00;
      const credLimit = input.credit_limit !== undefined ? input.credit_limit : 50000.00;
      const credStatus = input.credit_status || 'ACTIVE';

      const { rows } = await client.query<ResellerItem>(`
        INSERT INTO resellers (
          organization_id, branch_id, name, code, contact_person,
          phone, email, address, status, commission_model,
          commission_percent, credit_limit, credit_used, credit_status, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0.00, $13, $14)
        RETURNING *
      `, [
        org.id,
        input.branch_id || null,
        input.name,
        input.code.toUpperCase(),
        input.contact_person || null,
        input.phone || null,
        input.email || null,
        input.address || null,
        input.status || 'ACTIVE',
        input.commission_model || 'commission',
        commPercent,
        credLimit,
        credStatus,
        input.notes || null,
      ]);
      const reseller = rows[0];

      // Auto-provision reseller wallet
      const walletNumber = `WLT-RES-${reseller.code.toUpperCase()}`;
      const walletRes = await client.query<{ id: number }>(`
        INSERT INTO wallets (wallet_number, entity_type, reseller_id, balance, total_topup, total_used, status)
        VALUES ($1, 'reseller', $2, 0.00, 0.00, 0.00, 'ACTIVE')
        RETURNING id
      `, [walletNumber, reseller.id]);

      // Auto-provision credit account
      await client.query(`
        INSERT INTO credit_accounts (wallet_id, credit_enabled, credit_limit, used_credit, status)
        VALUES ($1, TRUE, $2, 0.00, $3)
      `, [walletRes.rows[0].id, credLimit, credStatus]);

      // Record initial commission in history
      await client.query(`
        INSERT INTO reseller_commission_history (reseller_id, previous_percent, new_percent, changed_by, reason)
        VALUES ($1, $2, $2, 'SYSTEM', 'Initial configuration')
      `, [reseller.id, commPercent]);

      // Optional: Provision reseller login portal account
      if (input.login_username && input.login_password) {
        const usernameClean = input.login_username.trim().toLowerCase();
        const existingUser = await client.query(`SELECT id FROM users WHERE lower(username) = $1`, [usernameClean]);
        if (existingUser.rows.length === 0) {
          const passwordHash = await bcrypt.hash(input.login_password, 10);
          const roleRes = await client.query<{ id: number }>(`SELECT id FROM roles WHERE name = 'reseller_admin'`);
          const roleId = roleRes.rows[0]?.id || 1;
          const userRes = await client.query<{ id: string }>(`
            INSERT INTO users (
              username, email, full_name, password_hash, role_id,
              user_type, reseller_id, status, is_active
            ) VALUES ($1, $2, $3, $4, $5, 'reseller', $6, 'ACTIVE', TRUE)
            RETURNING id
          `, [
            usernameClean,
            input.email || null,
            input.contact_person || input.name,
            passwordHash,
            roleId,
            reseller.id,
          ]);

          if (userRes.rows[0]?.id) {
            await client.query(`UPDATE resellers SET user_id = $1 WHERE id = $2`, [userRes.rows[0].id, reseller.id]);
          }
        }
      }

      await client.query('COMMIT');
      return (await this.getReseller(reseller.id))!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async updateReseller(id: number, input: Partial<ResellerItem>): Promise<ResellerItem> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (input.branch_id !== undefined) { fields.push(`branch_id = $${idx++}`); values.push(input.branch_id || null); }
    if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
    if (input.code !== undefined) { fields.push(`code = $${idx++}`); values.push(input.code.toUpperCase()); }
    if (input.contact_person !== undefined) { fields.push(`contact_person = $${idx++}`); values.push(input.contact_person); }
    if (input.phone !== undefined) { fields.push(`phone = $${idx++}`); values.push(input.phone); }
    if (input.email !== undefined) { fields.push(`email = $${idx++}`); values.push(input.email); }
    if (input.address !== undefined) { fields.push(`address = $${idx++}`); values.push(input.address); }
    if (input.status !== undefined) { fields.push(`status = $${idx++}`); values.push(input.status); }
    if (input.commission_model !== undefined) { fields.push(`commission_model = $${idx++}`); values.push(input.commission_model); }
    if (input.commission_percent !== undefined) { fields.push(`commission_percent = $${idx++}`); values.push(input.commission_percent); }
    if (input.credit_limit !== undefined) { fields.push(`credit_limit = $${idx++}`); values.push(input.credit_limit); }
    if (input.credit_status !== undefined) { fields.push(`credit_status = $${idx++}`); values.push(input.credit_status); }
    if (input.notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(input.notes); }

    if (fields.length > 0) {
      values.push(id);
      await query(`UPDATE resellers SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    }
    const updated = await this.getReseller(id);
    if (!updated) throw HttpError.notFound('Reseller not found');
    return updated;
  },

  async getResellerDashboardMetrics(resellerId: number) {
    const [subRes, finRes, wltRes, recentTxRes] = await Promise.all([
      query<{ total: string; active: string; expired: string }>(`
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE status = 'enabled' AND (expiry_date IS NULL OR expiry_date > NOW())) AS active,
               COUNT(*) FILTER (WHERE expiry_date <= NOW()) AS expired
          FROM subscribers
         WHERE reseller_id = $1
      `, [resellerId]),
      query<{ today_recharge: string; monthly_revenue: string; total_commission: string }>(`
        SELECT
          COALESCE(SUM(final_amount) FILTER (WHERE recharge_date >= CURRENT_DATE), 0) AS today_recharge,
          COALESCE(SUM(final_amount) FILTER (WHERE recharge_date >= date_trunc('month', CURRENT_DATE)), 0) AS monthly_revenue,
          COALESCE(SUM(commission_amount) FILTER (WHERE recharge_date >= date_trunc('month', CURRENT_DATE)), 0) AS total_commission
        FROM recharge_transactions
        WHERE reseller_id = $1
      `, [resellerId]),
      query<{
        balance: string;
        credit_limit: string;
        used_credit: string;
        credit_enabled: boolean;
      }>(`
        SELECT w.balance, COALESCE(c.credit_limit, 0) AS credit_limit,
               COALESCE(c.used_credit, 0) AS used_credit,
               COALESCE(c.credit_enabled, false) AS credit_enabled
          FROM wallets w
          LEFT JOIN credit_accounts c ON c.wallet_id = w.id
         WHERE w.reseller_id = $1
      `, [resellerId]),
      query<any>(`
        SELECT id, transaction_id, username, full_name, package_name, duration,
               final_amount, commission_amount, payment_method, recharge_date, status
          FROM recharge_transactions
         WHERE reseller_id = $1
         ORDER BY recharge_date DESC LIMIT 10
      `, [resellerId]),
    ]);

    const w = wltRes.rows[0];
    const balance = Number(w?.balance || 0);
    const creditLimit = Number(w?.credit_limit || 0);
    const usedCredit = Number(w?.used_credit || 0);
    const remainingCredit = Math.max(0, creditLimit - usedCredit);

    return {
      customers: Number(subRes.rows[0]?.total || 0),
      activeCustomers: Number(subRes.rows[0]?.active || 0),
      expiredCustomers: Number(subRes.rows[0]?.expired || 0),
      todayRecharge: Number(finRes.rows[0]?.today_recharge || 0),
      monthlyRevenue: Number(finRes.rows[0]?.monthly_revenue || 0),
      commission: Number(finRes.rows[0]?.total_commission || 0),
      walletBalance: balance,
      creditLimit: creditLimit,
      usedCredit: usedCredit,
      remainingCredit: remainingCredit,
      totalAvailable: balance + (w?.credit_enabled ? remainingCredit : 0),
      recentTransactions: recentTxRes.rows,
    };
  },

  // ===========================================================================
  // 4. Subscriber Ownership & Transfer
  // ===========================================================================
  async transferSubscriberOwnership(
    subscriberId: number,
    input: {
      ownership_type: 'head_office' | 'branch' | 'reseller';
      branch_id?: number | null;
      reseller_id?: number | null;
      reason: string;
      changed_by: string;
    }
  ): Promise<void> {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<{
        id: number;
        ownership_type: string;
        branch_id: number | null;
        reseller_id: number | null;
      }>(`
        SELECT id, ownership_type, branch_id, reseller_id
          FROM subscribers
         WHERE id = $1 FOR UPDATE
      `, [subscriberId]);

      if (!rows[0]) throw HttpError.notFound('Subscriber not found');
      const cur = rows[0];

      // Update subscriber
      await client.query(`
        UPDATE subscribers
           SET ownership_type = $2,
               branch_id = $3,
               reseller_id = $4
         WHERE id = $1
      `, [subscriberId, input.ownership_type, input.branch_id || null, input.reseller_id || null]);

      // Record history
      await client.query(`
        INSERT INTO subscriber_ownership_history (
          subscriber_id, previous_ownership_type, previous_branch_id, previous_reseller_id,
          new_ownership_type, new_branch_id, new_reseller_id, changed_by, reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        subscriberId,
        cur.ownership_type,
        cur.branch_id,
        cur.reseller_id,
        input.ownership_type,
        input.branch_id || null,
        input.reseller_id || null,
        input.changed_by,
        input.reason,
      ]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async getSubscriberOwnershipHistory(subscriberId: number): Promise<OwnershipHistoryItem[]> {
    const { rows } = await query<OwnershipHistoryItem>(`
      SELECT h.id, h.subscriber_id, s.username,
             h.previous_ownership_type,
             pb.name AS previous_branch_name,
             pr.name AS previous_reseller_name,
             h.new_ownership_type,
             nb.name AS new_branch_name,
             nr.name AS new_reseller_name,
             h.changed_by, h.reason, h.created_at
        FROM subscriber_ownership_history h
        JOIN subscribers s ON s.id = h.subscriber_id
        LEFT JOIN branches pb ON pb.id = h.previous_branch_id
        LEFT JOIN resellers pr ON pr.id = h.previous_reseller_id
        LEFT JOIN branches nb ON nb.id = h.new_branch_id
        LEFT JOIN resellers nr ON nr.id = h.new_reseller_id
       WHERE h.subscriber_id = $1
       ORDER BY h.created_at DESC
    `, [subscriberId]);
    return rows;
  },

  // ===========================================================================
  // 5. Wallets & Credit System
  // ===========================================================================
  async getWalletDashboardMetrics() {
    const [wltRes, todayRes, monthRes] = await Promise.all([
      query<{
        total_balance: string;
        total_topup: string;
        total_credit: string;
        used_credit: string;
      }>(`
        SELECT
          COALESCE(SUM(w.balance), 0) AS total_balance,
          COALESCE(SUM(w.total_topup), 0) AS total_topup,
          COALESCE(SUM(c.credit_limit) FILTER (WHERE c.credit_enabled = TRUE AND c.status = 'ACTIVE'), 0) AS total_credit,
          COALESCE(SUM(c.used_credit) FILTER (WHERE c.credit_enabled = TRUE), 0) AS used_credit
        FROM wallets w
        LEFT JOIN credit_accounts c ON c.wallet_id = w.id
      `),
      query<{
        today_topups: string;
        today_debits: string;
      }>(`
        SELECT
          COALESCE(SUM(amount) FILTER (WHERE type = 'TOP_UP' AND created_at >= CURRENT_DATE), 0) AS today_topups,
          COALESCE(SUM(amount) FILTER (WHERE type = 'DEBIT' AND created_at >= CURRENT_DATE), 0) AS today_debits
        FROM wallet_transactions
      `),
      query<{
        monthly_usage: string;
      }>(`
        SELECT
          COALESCE(SUM(amount) FILTER (WHERE type = 'DEBIT' AND created_at >= date_trunc('month', CURRENT_DATE)), 0) AS monthly_usage
        FROM wallet_transactions
      `),
    ]);

    const w = wltRes.rows[0];
    const totalBalance = Number(w?.total_balance || 0);
    const totalCredit = Number(w?.total_credit || 0);
    const usedCredit = Number(w?.used_credit || 0);
    const availableCredit = Math.max(0, totalCredit - usedCredit);

    return {
      totalWalletBalance: totalBalance,
      totalCreditLimit: totalCredit,
      usedCredit: usedCredit,
      availableCredit: availableCredit,
      todayTopups: Number(todayRes.rows[0]?.today_topups || 0),
      todayDebits: Number(todayRes.rows[0]?.today_debits || 0),
      monthlyWalletUsage: Number(monthRes.rows[0]?.monthly_usage || 0),
    };
  },

  async listWallets(filter?: { entityType?: 'branch' | 'reseller'; status?: string }): Promise<WalletItem[]> {
    const params: any[] = [];
    const where: string[] = [];

    if (filter?.entityType) {
      params.push(filter.entityType);
      where.push(`w.entity_type = $${params.length}`);
    }
    if (filter?.status) {
      params.push(filter.status);
      where.push(`w.status = $${params.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { rows } = await query<any>(`
      SELECT w.id, w.wallet_number, w.entity_type, w.branch_id, w.reseller_id,
             w.balance::float, w.total_topup::float, w.total_used::float,
             w.total_refund::float, w.total_adjusted::float, w.currency, w.status,
             w.created_at, w.updated_at,
             COALESCE(b.name, r.name) AS entity_name,
             COALESCE(b.code, r.code) AS entity_code,
             COALESCE(c.credit_enabled, false) AS credit_enabled,
             COALESCE(c.credit_limit, 0)::float AS credit_limit,
             COALESCE(c.used_credit, 0)::float AS used_credit,
             COALESCE(c.status, 'ACTIVE') AS credit_status,
             c.expiry_date AS credit_expiry
        FROM wallets w
        LEFT JOIN branches b ON b.id = w.branch_id
        LEFT JOIN resellers r ON r.id = w.reseller_id
        LEFT JOIN credit_accounts c ON c.wallet_id = w.id
       ${whereClause}
       ORDER BY w.id ASC
    `, params);

    return rows.map((r) => {
      const remaining = Math.max(0, (r.credit_limit || 0) - (r.used_credit || 0));
      return {
        ...r,
        remaining_credit: remaining,
        total_available: r.balance + (r.credit_enabled ? remaining : 0),
      };
    });
  },

  async getWallet(id: number): Promise<WalletItem | null> {
    const { rows } = await query<any>(`
      SELECT w.id, w.wallet_number, w.entity_type, w.branch_id, w.reseller_id,
             w.balance::float, w.total_topup::float, w.total_used::float,
             w.total_refund::float, w.total_adjusted::float, w.currency, w.status,
             w.created_at, w.updated_at,
             COALESCE(b.name, r.name) AS entity_name,
             COALESCE(b.code, r.code) AS entity_code,
             COALESCE(c.credit_enabled, false) AS credit_enabled,
             COALESCE(c.credit_limit, 0)::float AS credit_limit,
             COALESCE(c.used_credit, 0)::float AS used_credit,
             COALESCE(c.status, 'ACTIVE') AS credit_status,
             c.expiry_date AS credit_expiry
        FROM wallets w
        LEFT JOIN branches b ON b.id = w.branch_id
        LEFT JOIN resellers r ON r.id = w.reseller_id
        LEFT JOIN credit_accounts c ON c.wallet_id = w.id
       WHERE w.id = $1
    `, [id]);
    if (!rows[0]) return null;
    const r = rows[0];
    const remaining = Math.max(0, (r.credit_limit || 0) - (r.used_credit || 0));
    return {
      ...r,
      remaining_credit: remaining,
      total_available: r.balance + (r.credit_enabled ? remaining : 0),
    };
  },

  async getWalletByEntity(entityType: 'branch' | 'reseller', entityId: number): Promise<WalletItem | null> {
    const column = entityType === 'branch' ? 'branch_id' : 'reseller_id';
    const { rows } = await query<{ id: number }>(`SELECT id FROM wallets WHERE ${column} = $1`, [entityId]);
    if (!rows[0]) return null;
    return this.getWallet(rows[0].id);
  },

  // ---- CRITICAL: Top-Up Wallet (Super Admin Only) ----
  async topUpWallet(input: {
    walletId: number;
    amount: number;
    paymentMethod: string;
    paymentReference?: string;
    remarks?: string;
    idempotencyKey?: string;
    operator: string;
  }): Promise<WalletTransactionItem> {
    if (input.amount <= 0) {
      throw HttpError.badRequest('Top-up amount must be strictly greater than 0');
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Check idempotency
      if (input.idempotencyKey) {
        const dup = await client.query<WalletTransactionItem>(`
          SELECT * FROM wallet_transactions WHERE idempotency_key = $1
        `, [input.idempotencyKey]);
        if (dup.rows[0]) {
          await client.query('COMMIT');
          return dup.rows[0];
        }
      }

      // Lock wallet row
      const wRes = await client.query<{ id: number; balance: string; status: string }>(`
        SELECT id, balance, status FROM wallets WHERE id = $1 FOR UPDATE
      `, [input.walletId]);
      if (!wRes.rows[0]) throw HttpError.notFound('Wallet not found');
      if (wRes.rows[0].status !== 'ACTIVE') throw HttpError.forbidden('Wallet is suspended or locked');

      const prevBalance = Number(wRes.rows[0].balance);
      const newBalance = prevBalance + input.amount;

      // Update wallet balance
      await client.query(`
        UPDATE wallets
           SET balance = balance + $2,
               total_topup = total_topup + $2,
               updated_at = NOW()
         WHERE id = $1
      `, [input.walletId, input.amount]);

      // Generate transaction ID
      const txId = `WTX-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 9000 + 1000)}`;

      // Insert immutable ledger record
      const txRes = await client.query<WalletTransactionItem>(`
        INSERT INTO wallet_transactions (
          transaction_id, wallet_id, type, amount, balance_before, balance_after,
          credit_used_before, credit_used_after, reference, payment_method, reason,
          idempotency_key, created_by
        ) VALUES ($1, $2, 'TOP_UP', $3, $4, $5, 0, 0, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        txId,
        input.walletId,
        input.amount,
        prevBalance,
        newBalance,
        input.paymentReference || null,
        input.paymentMethod,
        input.remarks || 'Super Admin Wallet Top-up',
        input.idempotencyKey || null,
        input.operator,
      ]);

      await auditRepository.insert({
        username: input.operator,
        action: 'wallet.topup',
        entityType: 'wallet',
        entityId: String(input.walletId),
        status: 'success',
        metadata: {
          transactionId: txId,
          amount: input.amount,
          balanceBefore: prevBalance,
          balanceAfter: newBalance,
          paymentMethod: input.paymentMethod,
        },
      });

      await client.query('COMMIT');
      return txRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // ---- Adjust Wallet Balance (Super Admin / Authorized Adjuster) ----
  async adjustWalletBalance(input: {
    walletId: number;
    amount: number;
    direction: 'credit' | 'debit';
    reason: string;
    operator: string;
  }): Promise<WalletTransactionItem> {
    if (input.amount <= 0) throw HttpError.badRequest('Adjustment amount must be positive');
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const wRes = await client.query<{ id: number; balance: string }>(`
        SELECT id, balance FROM wallets WHERE id = $1 FOR UPDATE
      `, [input.walletId]);
      if (!wRes.rows[0]) throw HttpError.notFound('Wallet not found');

      const prev = Number(wRes.rows[0].balance);
      let next = prev;
      if (input.direction === 'credit') {
        next = prev + input.amount;
        await client.query(`
          UPDATE wallets SET balance = balance + $2, total_adjusted = total_adjusted + $2 WHERE id = $1
        `, [input.walletId, input.amount]);
      } else {
        if (prev < input.amount) throw HttpError.badRequest(`Cannot debit Rs. ${input.amount}; current balance is Rs. ${prev}`);
        next = prev - input.amount;
        await client.query(`
          UPDATE wallets SET balance = balance - $2, total_adjusted = total_adjusted - $2 WHERE id = $1
        `, [input.walletId, input.amount]);
      }

      const txId = `WTX-ADJ-${Date.now().toString(36).toUpperCase()}`;
      const { rows } = await client.query<WalletTransactionItem>(`
        INSERT INTO wallet_transactions (
          transaction_id, wallet_id, type, amount, balance_before, balance_after,
          reference, reason, created_by
        ) VALUES ($1, $2, 'ADJUSTMENT', $3, $4, $5, 'ADMIN-ADJUST', $6, $7)
        RETURNING *
      `, [txId, input.walletId, input.amount, prev, next, input.reason, input.operator]);

      await client.query('COMMIT');
      return rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // ---- Credit Control Configuration ----
  async updateCreditAccount(input: {
    walletId: number;
    creditEnabled: boolean;
    creditLimit: number;
    startDate?: string | null;
    expiryDate?: string | null;
    status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
    notes?: string;
    operator: string;
  }) {
    const { rows } = await query(`
      INSERT INTO credit_accounts (wallet_id, credit_enabled, credit_limit, start_date, expiry_date, status, notes, updated_by, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (wallet_id) DO UPDATE SET
        credit_enabled = EXCLUDED.credit_enabled,
        credit_limit = EXCLUDED.credit_limit,
        start_date = EXCLUDED.start_date,
        expiry_date = EXCLUDED.expiry_date,
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      RETURNING *
    `, [
      input.walletId,
      input.creditEnabled,
      input.creditLimit,
      input.startDate || null,
      input.expiryDate || null,
      input.status,
      input.notes || null,
      input.operator,
    ]);
    return rows[0];
  },

  // ---- Wallet Ledger / Transactions List ----
  async listWalletTransactions(options?: {
    walletId?: number;
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ transactions: WalletTransactionItem[]; total: number }> {
    const params: any[] = [];
    const where: string[] = [];

    if (options?.walletId) {
      params.push(options.walletId);
      where.push(`wt.wallet_id = $${params.length}`);
    }
    if (options?.type) {
      params.push(options.type);
      where.push(`wt.type = $${params.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRes = await query<{ count: string }>(`
      SELECT COUNT(*) AS count FROM wallet_transactions wt ${whereClause}
    `, params);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    params.push(limit, offset);

    const { rows } = await query<any>(`
      SELECT wt.id, wt.transaction_id, wt.wallet_id, wt.type, wt.amount::float,
             wt.balance_before::float, wt.balance_after::float,
             wt.credit_used_before::float, wt.credit_used_after::float,
             wt.reference, wt.payment_method, wt.reason, wt.idempotency_key,
             wt.created_by, wt.created_at,
             w.wallet_number, w.entity_type,
             COALESCE(b.name, r.name) AS entity_name
        FROM wallet_transactions wt
        JOIN wallets w ON w.id = wt.wallet_id
        LEFT JOIN branches b ON b.id = w.branch_id
        LEFT JOIN resellers r ON r.id = w.reseller_id
       ${whereClause}
       ORDER BY wt.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    return { transactions: rows, total };
  },

  // ===========================================================================
  // 6. Channel Pricing & Commission Rules
  // ===========================================================================
  async listPricingRules(filter?: {
    channelType?: 'branch' | 'reseller';
    branchId?: number;
    resellerId?: number;
    packageId?: number;
  }): Promise<ChannelPricingRuleItem[]> {
    const params: any[] = [];
    const where: string[] = [];

    if (filter?.channelType) {
      params.push(filter.channelType);
      where.push(`cpr.channel_type = $${params.length}`);
    }
    if (filter?.branchId) {
      params.push(filter.branchId);
      where.push(`cpr.branch_id = $${params.length}`);
    }
    if (filter?.resellerId) {
      params.push(filter.resellerId);
      where.push(`cpr.reseller_id = $${params.length}`);
    }
    if (filter?.packageId) {
      params.push(filter.packageId);
      where.push(`cpr.package_id = $${params.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await query<any>(`
      SELECT cpr.id, cpr.rule_name, cpr.channel_type, cpr.branch_id, cpr.reseller_id,
             cpr.package_id, cpr.duration_months, cpr.rule_type, cpr.value::float,
             cpr.is_active, cpr.notes, cpr.created_by, cpr.created_at, cpr.updated_at,
             b.name AS branch_name,
             r.name AS reseller_name,
             p.name AS package_name
        FROM channel_pricing_rules cpr
        LEFT JOIN branches b ON b.id = cpr.branch_id
        LEFT JOIN resellers r ON r.id = cpr.reseller_id
        LEFT JOIN packages p ON p.id = cpr.package_id
       ${whereClause}
       ORDER BY cpr.id ASC
    `, params);
    return rows;
  },

  async createPricingRule(input: {
    rule_name: string;
    channel_type: 'branch' | 'reseller';
    branch_id?: number | null;
    reseller_id?: number | null;
    package_id?: number | null;
    duration_months?: number | null;
    rule_type: 'percentage_discount' | 'percentage_commission' | 'fixed_discount' | 'fixed_override';
    value: number;
    notes?: string;
    created_by: string;
  }): Promise<ChannelPricingRuleItem> {
    const { rows } = await query<any>(`
      INSERT INTO channel_pricing_rules (
        rule_name, channel_type, branch_id, reseller_id, package_id,
        duration_months, rule_type, value, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      input.rule_name,
      input.channel_type,
      input.branch_id || null,
      input.reseller_id || null,
      input.package_id || null,
      input.duration_months || null,
      input.rule_type,
      input.value,
      input.notes || null,
      input.created_by,
    ]);
    return rows[0];
  },

  async deletePricingRule(id: number): Promise<void> {
    await query(`DELETE FROM channel_pricing_rules WHERE id = $1`, [id]);
  },

  // Calculate price for a channel transaction
  async resolveChannelPrice(params: {
    packageId: number;
    durationMonths: number;
    channelType: 'branch' | 'reseller';
    entityId: number; // branch_id or reseller_id
  }): Promise<{
    originalPrice: number;
    channelPrice: number;
    discountOrCommission: number;
    ruleApplied: string | null;
  }> {
    // 1. Get package base price for duration
    const pkgRes = await query<{ price: string }>(`SELECT price FROM packages WHERE id = $1`, [params.packageId]);
    if (!pkgRes.rows[0]) throw HttpError.notFound('Package not found');
    const baseMonthlyPrice = Number(pkgRes.rows[0].price);

    // Multi-month default calculation (consistent with Phase 5)
    let standardPrice = baseMonthlyPrice * params.durationMonths;
    if (params.durationMonths === 3) standardPrice = Math.round(standardPrice * 0.95);
    else if (params.durationMonths === 6) standardPrice = Math.round(standardPrice * 0.90);
    else if (params.durationMonths === 12) standardPrice = Math.round(standardPrice * 0.83);

    // 2. Query pricing rules in precedence order:
    // 1. Specific entity + specific package + specific duration
    // 2. Specific entity + specific package + all durations
    // 3. Specific entity + all packages + specific duration
    // 4. Specific entity + all packages + all durations
    // 5. Channel-wide + specific package + specific duration
    // 6. Channel-wide + specific package + all durations
    // 7. Channel-wide default
    const entityCol = params.channelType === 'branch' ? 'branch_id' : 'reseller_id';
    const { rows: rules } = await query<ChannelPricingRuleItem>(`
      SELECT *
        FROM channel_pricing_rules
       WHERE is_active = TRUE
         AND channel_type = $1
         AND (${entityCol} = $2 OR ${entityCol} IS NULL)
         AND (package_id = $3 OR package_id IS NULL)
         AND (duration_months = $4 OR duration_months IS NULL)
       ORDER BY
         (${entityCol} IS NOT NULL) DESC,
         (package_id IS NOT NULL) DESC,
         (duration_months IS NOT NULL) DESC,
         id DESC
       LIMIT 1
    `, [params.channelType, params.entityId, params.packageId, params.durationMonths]);

    if (!rules[0]) {
      return {
        originalPrice: standardPrice,
        channelPrice: standardPrice,
        discountOrCommission: 0,
        ruleApplied: null,
      };
    }

    const r = rules[0];
    let channelPrice = standardPrice;
    let diff = 0;

    if (r.rule_type === 'percentage_discount') {
      diff = Math.round((standardPrice * r.value) / 100);
      channelPrice = Math.max(0, standardPrice - diff);
    } else if (r.rule_type === 'percentage_commission') {
      diff = Math.round((standardPrice * r.value) / 100);
      channelPrice = Math.max(0, standardPrice - diff);
    } else if (r.rule_type === 'fixed_discount') {
      diff = Math.min(standardPrice, r.value);
      channelPrice = Math.max(0, standardPrice - diff);
    } else if (r.rule_type === 'fixed_override') {
      channelPrice = r.value;
      diff = Math.max(0, standardPrice - channelPrice);
    }

    return {
      originalPrice: standardPrice,
      channelPrice,
      discountOrCommission: diff,
      ruleApplied: `${r.rule_name} (${r.value}${r.rule_type.startsWith('percentage') ? '%' : ' NPR'})`,
    };
  },

  // ===========================================================================
  // 7. Channel Recharge Execution (Database Transactional with Wallet Debit)
  // ===========================================================================
  async executeChannelRecharge(input: {
    subscriberId: number;
    packageId: number;
    durationMonths: number;
    channelType: 'branch' | 'reseller';
    channelEntityId: number; // branch_id or reseller_id
    idempotencyKey?: string;
    paymentReference?: string;
    notes?: string;
    operator: string;
  }) {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // 1. Validate Subscriber
      const subRes = await client.query<any>(`
        SELECT s.id, s.username, s.customer_id, s.full_name, s.expiry_date,
               s.status, s.ownership_type, s.branch_id, s.reseller_id,
               p.id AS current_package_id, p.name AS current_package_name
          FROM subscribers s
          LEFT JOIN packages p ON p.id = s.package_id
         WHERE s.id = $1 FOR UPDATE
      `, [input.subscriberId]);
      if (!subRes.rows[0]) throw HttpError.notFound('Subscriber not found');
      const sub = subRes.rows[0];

      // 2. Validate Ownership Isolation
      if (input.channelType === 'reseller' && sub.reseller_id !== input.channelEntityId) {
        throw HttpError.forbidden('Access Denied: Subscriber does not belong to this reseller');
      }
      if (input.channelType === 'branch' && sub.branch_id !== input.channelEntityId) {
        throw HttpError.forbidden('Access Denied: Subscriber does not belong to this branch');
      }

      // 3. Resolve Channel Price
      const priceCalc = await this.resolveChannelPrice({
        packageId: input.packageId,
        durationMonths: input.durationMonths,
        channelType: input.channelType,
        entityId: input.channelEntityId,
      });

      const requiredAmount = priceCalc.channelPrice;

      // 4. Fetch and Lock Wallet & Credit Account
      const walletCol = input.channelType === 'branch' ? 'branch_id' : 'reseller_id';
      const wltRes = await client.query<{
        id: number;
        wallet_number: string;
        balance: string;
        status: string;
      }>(`
        SELECT id, wallet_number, balance, status
          FROM wallets
         WHERE ${walletCol} = $1 FOR UPDATE
      `, [input.channelEntityId]);

      if (!wltRes.rows[0]) throw HttpError.badRequest('No wallet provisioned for this entity');
      const wallet = wltRes.rows[0];
      if (wallet.status !== 'ACTIVE') throw HttpError.forbidden('Wallet is suspended or locked');

      const crdRes = await client.query<{
        credit_enabled: boolean;
        credit_limit: string;
        used_credit: string;
        status: string;
      }>(`
        SELECT credit_enabled, credit_limit, used_credit, status
          FROM credit_accounts
         WHERE wallet_id = $1 FOR UPDATE
      `, [wallet.id]);

      const crd = crdRes.rows[0] || { credit_enabled: false, credit_limit: '0', used_credit: '0', status: 'ACTIVE' };
      const currentCash = Number(wallet.balance);
      const creditLimit = Number(crd.credit_limit);
      const usedCredit = Number(crd.used_credit);
      const availableCredit = (crd.credit_enabled && crd.status === 'ACTIVE')
        ? Math.max(0, creditLimit - usedCredit)
        : 0;
      const totalAvailable = currentCash + availableCredit;

      if (requiredAmount > totalAvailable) {
        throw HttpError.badRequest(
          `Insufficient purchasing capacity. Required: Rs. ${requiredAmount}, Total Available: Rs. ${totalAvailable} (Cash: Rs. ${currentCash}, Credit: Rs. ${availableCredit})`
        );
      }

      // 5. Compute Deductions from Cash and Credit
      let cashDeduct = 0;
      let creditDeduct = 0;

      if (currentCash >= requiredAmount) {
        cashDeduct = requiredAmount;
      } else {
        cashDeduct = currentCash;
        creditDeduct = requiredAmount - currentCash;
      }

      const newCashBalance = currentCash - cashDeduct;
      const newUsedCredit = usedCredit + creditDeduct;

      // 6. Update Wallet & Credit
      await client.query(`
        UPDATE wallets
           SET balance = balance - $2,
               total_used = total_used + $2,
               updated_at = NOW()
         WHERE id = $1
      `, [wallet.id, cashDeduct]);

      if (creditDeduct > 0) {
        await client.query(`
          UPDATE credit_accounts
             SET used_credit = used_credit + $2,
                 updated_at = NOW()
           WHERE wallet_id = $1
        `, [wallet.id, creditDeduct]);
      }

      // 7. Calculate Expiry Date Extension
      const now = new Date();
      let baseDate = now;
      const curExpiry = sub.expiry_date ? new Date(sub.expiry_date) : null;
      if (curExpiry && curExpiry > now) {
        baseDate = curExpiry;
      }
      const newExpiry = new Date(baseDate);
      newExpiry.setMonth(newExpiry.getMonth() + input.durationMonths);

      // 8. Generate Transaction and Receipt IDs
      const txId = `TXN-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 9000 + 1000)}`;
      const receiptNo = `REC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 90000 + 10000)}`;

      // 9. Fetch Package Name
      const pkgInfoRes = await client.query<{ name: string }>(`SELECT name FROM packages WHERE id = $1`, [input.packageId]);
      const pkgName = pkgInfoRes.rows[0]?.name || 'Broadband Plan';

      // 10. Record Recharge Transaction
      const org = await this.getPrimaryOrganization();
      const branchId = input.channelType === 'branch' ? input.channelEntityId : sub.branch_id;
      const resellerId = input.channelType === 'reseller' ? input.channelEntityId : null;

      await client.query(`
        INSERT INTO recharge_transactions (
          transaction_id, receipt_no, subscriber_id, username, customer_id, full_name,
          package_id, package_name, duration, duration_unit, original_price,
          discount_type, discount_value, discount_amount, final_amount,
          currency, payment_method, payment_reference, recharge_date, previous_expiry,
          new_expiry, status, created_by, notes, idempotency_key,
          organization_id, branch_id, reseller_id, wallet_id, commission_amount
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, 'months', $10,
          $11, $12, $13, $14,
          'NPR', $15, $16, NOW(), $17,
          $18, 'COMPLETED', $19, $20, $21,
          $22, $23, $24, $25, $26
        )
      `, [
        txId,
        receiptNo,
        sub.id,
        sub.username,
        sub.customer_id,
        sub.full_name,
        input.packageId,
        pkgName,
        input.durationMonths,
        priceCalc.originalPrice,
        priceCalc.discountOrCommission > 0 ? 'percentage' : 'none',
        priceCalc.discountOrCommission,
        priceCalc.discountOrCommission,
        requiredAmount,
        'WALLET',
        input.paymentReference || wallet.wallet_number,
        sub.expiry_date,
        newExpiry.toISOString(),
        input.operator,
        input.notes || `Channel recharge via ${wallet.wallet_number}`,
        input.idempotencyKey || null,
        org.id,
        branchId,
        resellerId,
        wallet.id,
        priceCalc.discountOrCommission,
      ]);

      // 11. Record Wallet Transaction Ledger
      const wtxId = `WTX-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 9000 + 1000)}`;
      await client.query(`
        INSERT INTO wallet_transactions (
          transaction_id, wallet_id, type, amount, balance_before, balance_after,
          credit_used_before, credit_used_after, reference, payment_method, reason,
          idempotency_key, created_by
        ) VALUES ($1, $2, 'DEBIT', $3, $4, $5, $6, $7, $8, 'WALLET', $9, $10, $11)
      `, [
        wtxId,
        wallet.id,
        requiredAmount,
        currentCash,
        newCashBalance,
        usedCredit,
        newUsedCredit,
        receiptNo,
        `Recharge ${sub.username} (${input.durationMonths}mo) - ${pkgName}`,
        input.idempotencyKey ? `WTX-${input.idempotencyKey}` : null,
        input.operator,
      ]);

      // 12. Update Subscriber Service
      await client.query(`
        UPDATE subscribers
           SET package_id = $2,
               expiry_date = $3,
               status = 'enabled',
               updated_at = NOW()
         WHERE id = $1
      `, [sub.id, input.packageId, newExpiry.toISOString()]);

      // Update radcheck attribute Expiration if present
      await client.query(`
        UPDATE radcheck
           SET value = to_char($2::timestamptz, 'DD Mon YYYY HH24:MI:SS')
         WHERE username = $1 AND attribute = 'Expiration'
      `, [sub.username, newExpiry.toISOString()]);

      // Record Audit
      await auditRepository.insert({
        username: input.operator,
        action: 'channel.recharge',
        entityType: 'subscriber',
        entityId: String(sub.id),
        status: 'success',
        metadata: {
          transactionId: txId,
          receiptNo,
          walletId: wallet.id,
          amountDebited: requiredAmount,
          cashDeducted: cashDeduct,
          creditDeducted: creditDeduct,
          newExpiry: newExpiry.toISOString(),
        },
      });

      await client.query('COMMIT');

      return {
        transactionId: txId,
        receiptNo,
        subscriberId: sub.id,
        username: sub.username,
        packageName: pkgName,
        duration: input.durationMonths,
        originalPrice: priceCalc.originalPrice,
        channelPrice: requiredAmount,
        discountOrCommission: priceCalc.discountOrCommission,
        walletCashRemaining: newCashBalance,
        usedCredit: newUsedCredit,
        newExpiry: newExpiry.toISOString(),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // ===========================================================================
  // 8. Reseller Commission Report
  // ===========================================================================
  async getCommissionReport(filter?: {
    resellerId?: number;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }) {
    const params: any[] = [];
    const where: string[] = ['rt.reseller_id IS NOT NULL'];

    if (filter?.resellerId) {
      params.push(filter.resellerId);
      where.push(`rt.reseller_id = $${params.length}`);
    }
    if (filter?.startDate) {
      params.push(filter.startDate);
      where.push(`rt.recharge_date >= $${params.length}`);
    }
    if (filter?.endDate) {
      params.push(filter.endDate);
      where.push(`rt.recharge_date <= $${params.length}`);
    }

    const whereClause = `WHERE ${where.join(' AND ')}`;

    // Totals
    const totRes = await query<{
      gross: string;
      discount: string;
      commission: string;
      net: string;
      count: string;
    }>(`
      SELECT
        COALESCE(SUM(rt.original_price), 0) AS gross,
        COALESCE(SUM(rt.discount_amount), 0) AS discount,
        COALESCE(SUM(rt.commission_amount), 0) AS commission,
        COALESCE(SUM(rt.final_amount), 0) AS net,
        COUNT(*) AS count
      FROM recharge_transactions rt
      ${whereClause}
    `, params);

    const total = parseInt(totRes.rows[0]?.count || '0', 10);
    const limit = filter?.limit || 50;
    const offset = filter?.offset || 0;
    params.push(limit, offset);

    const { rows } = await query<any>(`
      SELECT rt.id, rt.transaction_id, rt.receipt_no, rt.subscriber_id,
             rt.username, rt.customer_id, rt.full_name, rt.package_name,
             rt.duration, rt.original_price::float, rt.discount_amount::float,
             rt.final_amount::float, rt.commission_amount::float,
             rt.recharge_date, rt.status,
             r.name AS reseller_name, r.code AS reseller_code
        FROM recharge_transactions rt
        JOIN resellers r ON r.id = rt.reseller_id
       ${whereClause}
       ORDER BY rt.recharge_date DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    return {
      totals: {
        gross: Number(totRes.rows[0]?.gross || 0),
        discount: Number(totRes.rows[0]?.discount || 0),
        commission: Number(totRes.rows[0]?.commission || 0),
        netIspRevenue: Number(totRes.rows[0]?.net || 0),
      },
      items: rows,
      total,
    };
  },
};
