import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query, getClient } from '../db/pool';
import { HttpError } from '../lib/http-error';
import { auditRepository } from './audit.repository';
import {
  isSuperAdmin,
  isBranchUser,
  isResellerUser,
  assertCanAssignRole,
  assertCanGrantPermissions,
  assertCanManageUser,
  isDeveloperOnlyPermission,
} from '../lib/access-control';
import type { AuthSession } from '../services/auth.service';

export const PERMISSION_CATALOG: Array<{ key: string; module: string; description: string }> = [
  // Developer & System
  { key: 'system.developer_config', module: 'system', description: 'Access developer-only settings and technical configuration' },
  { key: 'system.diagnostics', module: 'system', description: 'Access developer system diagnostics, raw socket tests, and recovery tools' },
  { key: 'system.database_tools', module: 'system', description: 'Access database migration and schema management tools' },
  { key: 'platform.organizations.manage', module: 'system', description: 'Manage platform-level multi-organization entities' },

  // Dashboard
  { key: 'dashboard.view', module: 'dashboard', description: 'View general dashboard metrics and widgets' },
  { key: 'dashboard.export', module: 'dashboard', description: 'Export dashboard summaries and KPIs' },

  // User Management
  { key: 'users.view', module: 'users', description: 'View staff user accounts and login records' },
  { key: 'users.create', module: 'users', description: 'Create new staff user accounts' },
  { key: 'users.edit', module: 'users', description: 'Edit user accounts and information' },
  { key: 'users.disable', module: 'users', description: 'Disable, enable, or suspend user accounts' },
  { key: 'users.delete', module: 'users', description: 'Permanently delete user accounts where safe' },
  { key: 'users.reset_password', module: 'users', description: 'Reset user passwords and force password resets' },
  { key: 'users.force_logout', module: 'users', description: 'Force terminate user active sessions' },
  { key: 'users.export', module: 'users', description: 'Export staff user directory to CSV/Excel' },

  // Role Management
  { key: 'roles.view', module: 'roles', description: 'View role definitions and assigned permissions' },
  { key: 'roles.create', module: 'roles', description: 'Create custom operational roles' },
  { key: 'roles.edit', module: 'roles', description: 'Modify roles and permission mappings' },
  { key: 'roles.delete', module: 'roles', description: 'Delete custom roles' },
  { key: 'roles.assign', module: 'roles', description: 'Assign roles to user accounts' },

  // Organization & Hierarchy
  { key: 'organization.view', module: 'organization', description: 'View ISP organization profiles and metrics' },
  { key: 'organization.edit', module: 'organization', description: 'Configure organization details, branding and settings' },
  { key: 'organization.report', module: 'organization', description: 'Generate organization-level consolidated reports' },
  { key: 'branch.view', module: 'branch', description: 'View branch listing, profiles and statistics' },
  { key: 'branch.create', module: 'branch', description: 'Create new branch locations' },
  { key: 'branch.edit', module: 'branch', description: 'Update branch details and operational statuses' },
  { key: 'branch.delete', module: 'branch', description: 'Deactivate or remove branch entities' },
  { key: 'branch.report', module: 'branch', description: 'Generate branch-level performance and financial reports' },
  { key: 'reseller.view', module: 'reseller', description: 'View reseller accounts, profiles and commissions' },
  { key: 'reseller.create', module: 'reseller', description: 'Onboard new reseller accounts' },
  { key: 'reseller.edit', module: 'reseller', description: 'Modify reseller configuration and commission models' },
  { key: 'reseller.suspend', module: 'reseller', description: 'Suspend or reactivate reseller access' },
  { key: 'reseller.delete', module: 'reseller', description: 'Delete or deactivate reseller accounts' },
  { key: 'reseller.report', module: 'reseller', description: 'Generate reseller sales, recharge and commission reports' },
  { key: 'reseller.pricing.view', module: 'reseller', description: 'View reseller custom package pricing overrides' },
  { key: 'reseller.pricing.edit', module: 'reseller', description: 'Configure reseller custom package pricing overrides' },

  // Subscribers / Customers
  { key: 'subscriber.view', module: 'subscribers', description: 'View subscribers and profiles' },
  { key: 'subscriber.create', module: 'subscribers', description: 'Register new subscriber accounts' },
  { key: 'subscriber.edit', module: 'subscribers', description: 'Modify subscriber account details and credentials' },
  { key: 'subscriber.activate', module: 'subscribers', description: 'Activate subscriber internet access' },
  { key: 'subscriber.suspend', module: 'subscribers', description: 'Suspend subscriber internet access' },
  { key: 'subscriber.resume', module: 'subscribers', description: 'Resume subscriber internet access' },
  { key: 'subscriber.terminate', module: 'subscribers', description: 'Terminate subscriber accounts' },
  { key: 'subscriber.recharge', module: 'subscribers', description: 'Perform service recharge for subscribers' },
  { key: 'subscriber.change_package', module: 'subscribers', description: 'Change subscriber service package tier' },
  { key: 'subscriber.change_speed', module: 'subscribers', description: 'Modify subscriber dynamic speed limit via CoA' },
  { key: 'subscriber.change_ip', module: 'subscribers', description: 'Assign or modify static IP addresses' },
  { key: 'subscriber.export', module: 'subscribers', description: 'Export subscriber database to CSV' },
  { key: 'subscriber.unbind_mac', module: 'subscribers', description: 'Unbind customer MAC address' },

  // Packages & Pricing
  { key: 'package.view', module: 'packages', description: 'View bandwidth service packages' },
  { key: 'package.create', module: 'packages', description: 'Create new bandwidth service packages' },
  { key: 'package.edit', module: 'packages', description: 'Modify bandwidth package configurations and rates' },
  { key: 'package.delete', module: 'packages', description: 'Deactivate or delete service packages' },
  { key: 'package.price', module: 'packages', description: 'Configure multi-duration pricing tiers' },

  // RADIUS & NAS
  { key: 'radius.view', module: 'radius', description: 'View RADIUS server status and activity' },
  { key: 'radius.test', module: 'radius', description: 'Execute synthetic RADIUS authentication tests' },
  { key: 'radius.disconnect', module: 'radius', description: 'Send Disconnect-Request (PoD) packets' },
  { key: 'radius.coa', module: 'radius', description: 'Send Change-of-Authorization (CoA) packets' },
  { key: 'radius.restart', module: 'radius', description: 'Restart FreeRADIUS services and reload dictionary' },
  { key: 'nas.view', module: 'nas', description: 'View NAS / BNG gateway inventory' },
  { key: 'nas.create', module: 'nas', description: 'Add NAS / BNG gateway devices' },
  { key: 'nas.edit', module: 'nas', description: 'Update NAS / BNG gateway settings and secrets' },
  { key: 'nas.delete', module: 'nas', description: 'Remove NAS / BNG gateway devices' },

  // OLT & Optical Network
  { key: 'olt.view', module: 'olt', description: 'View OLT inventory, status, and boards' },
  { key: 'olt.create', module: 'olt', description: 'Register new OLT devices' },
  { key: 'olt.edit', module: 'olt', description: 'Modify OLT device configurations and credentials' },
  { key: 'olt.delete', module: 'olt', description: 'Remove OLT devices from inventory' },
  { key: 'olt.test_connection', module: 'olt', description: 'Execute CLI and SNMP connectivity tests to OLT' },
  { key: 'olt.discover', module: 'olt', description: 'Run unregistered ONU discovery on OLT PON ports' },
  { key: 'olt.sync', module: 'olt', description: 'Synchronize live ONU inventory with OLT hardware' },
  { key: 'olt.view_optical', module: 'olt', description: 'Read and view ONU optical power and diagnostics' },
  { key: 'olt.register_onu', module: 'olt', description: 'Provision and register ONUs and service ports' },
  { key: 'olt.delete_onu', module: 'olt', description: 'Unregister and delete ONUs from OLT' },
  { key: 'olt.manage_profiles', module: 'olt', description: 'Manage line and service profile catalogs' },
  { key: 'olt.view_history', module: 'olt', description: 'View OLT operations, execution logs, and audit trail' },

  // IP Pools
  { key: 'ip_pools.view', module: 'ip_pools', description: 'View IPv4 and IPv6 subnet pools' },
  { key: 'ip_pools.manage', module: 'ip_pools', description: 'Allocate, edit, or delete IP subnet pools' },

  // Sessions, Logs & Accounting
  { key: 'sessions.view', module: 'sessions', description: 'View active online subscriber sessions' },
  { key: 'sessions.disconnect', module: 'sessions', description: 'Terminate subscriber active sessions' },
  { key: 'sessions.export', module: 'sessions', description: 'Export active session lists to CSV' },
  { key: 'auth_logs.view', module: 'auth_logs', description: 'View live RADIUS authentication attempts' },
  { key: 'auth_logs.export', module: 'auth_logs', description: 'Export authentication log records to CSV' },
  { key: 'accounting.view', module: 'accounting', description: 'View FreeRADIUS accounting session history' },
  { key: 'accounting.export', module: 'accounting', description: 'Export accounting records to CSV' },

  // Billing & Financials
  { key: 'billing.view', module: 'billing', description: 'View financial invoices, receipts and revenue summaries' },
  { key: 'billing.recharge', module: 'billing', description: 'Process subscriber renewals and recharges' },
  { key: 'billing.discount', module: 'billing', description: 'Apply promotional discounts on recharges' },
  { key: 'billing.adjustment', module: 'billing', description: 'Apply manual financial credit and debit adjustments' },
  { key: 'billing.refund', module: 'billing', description: 'Process service refunds and transaction reversals' },
  { key: 'billing.invoice', module: 'billing', description: 'Generate and download tax invoices' },
  { key: 'billing.receipt', module: 'billing', description: 'Issue customer payment receipts' },
  { key: 'billing.report', module: 'billing', description: 'View comprehensive financial sales reports' },
  { key: 'billing.export', module: 'billing', description: 'Export billing transactions and ledger records' },

  // Wallets & Credit
  { key: 'wallet.view', module: 'wallets', description: 'View channel wallet balances and ledgers' },
  { key: 'wallet.topup', module: 'wallets', description: 'Perform cash and credit wallet balance top-ups' },
  { key: 'wallet.debit', module: 'wallets', description: 'Debit wallet balances for transactions' },
  { key: 'wallet.adjust', module: 'wallets', description: 'Reconcile and adjust wallet balances' },
  { key: 'wallet.refund', module: 'wallets', description: 'Reverse and refund wallet balance debits' },
  { key: 'wallet.report', module: 'wallets', description: 'Generate wallet transactions and balance audit reports' },
  { key: 'reseller.wallet.view', module: 'wallets', description: 'View reseller wallet balance and transaction ledger' },
  { key: 'reseller.wallet.topup', module: 'wallets', description: 'Add balance to reseller wallet (Cash & Credit)' },
  { key: 'reseller.wallet.adjust', module: 'wallets', description: 'Manually adjust reseller balance' },
  { key: 'reseller.wallet.refund', module: 'wallets', description: 'Process refund on reseller wallet' },
  { key: 'credit.view', module: 'credit', description: 'View credit facilities and limits' },
  { key: 'credit.create', module: 'credit', description: 'Grant credit top-up to channels' },
  { key: 'credit.edit', module: 'credit', description: 'Adjust credit limits and terms' },
  { key: 'credit.suspend', module: 'credit', description: 'Freeze or suspend credit facilities' },
  { key: 'reseller.credit.view', module: 'credit', description: 'View reseller credit facility and used credit' },
  { key: 'reseller.credit.create', module: 'credit', description: 'Grant credit top-up to reseller' },
  { key: 'reseller.credit.adjust', module: 'credit', description: 'Adjust reseller credit limit' },
  { key: 'reseller.credit.suspend', module: 'credit', description: 'Suspend reseller credit facility' },
  { key: 'reseller.credit.override', module: 'credit', description: 'Override credit limit during top-up' },

  // Commission
  { key: 'commission.view', module: 'commission', description: 'View reseller commission percentages and rates' },
  { key: 'commission.report', module: 'commission', description: 'View reseller commission earnings ledger and reports' },
  { key: 'commission.payout', module: 'commission', description: 'Process commission settlements and payouts' },

  // Reports
  { key: 'reports.view', module: 'reports', description: 'View centralized ISP operational and analytical reports' },
  { key: 'reports.export', module: 'reports', description: 'Export analytical reports to CSV or PDF' },

  // CRM & Support Tickets
  { key: 'crm.view', module: 'crm', description: 'View customer CRM profile, history, and timeline' },
  { key: 'crm.create', module: 'crm', description: 'Add CRM notes and log customer communications' },
  { key: 'crm.edit', module: 'crm', description: 'Edit customer CRM notes and pinned items' },
  { key: 'crm.delete', module: 'crm', description: 'Delete customer CRM records' },
  { key: 'tickets.view', module: 'tickets', description: 'View customer complaints and support tickets' },
  { key: 'tickets.create', module: 'tickets', description: 'Create new customer support tickets' },
  { key: 'tickets.edit', module: 'tickets', description: 'Update ticket subject, description and priority' },
  { key: 'tickets.assign', module: 'tickets', description: 'Assign tickets to staff and field technicians' },
  { key: 'tickets.comment', module: 'tickets', description: 'Post internal and public ticket comments' },
  { key: 'tickets.close', module: 'tickets', description: 'Resolve and close support tickets' },
  { key: 'tickets.reopen', module: 'tickets', description: 'Reopen resolved or closed support tickets' },
  { key: 'tickets.delete', module: 'tickets', description: 'Delete invalid or duplicate tickets' },

  // Notifications, Audit Logs & Settings
  { key: 'notifications.view', module: 'notifications', description: 'View received notifications and alerts' },
  { key: 'notifications.create', module: 'notifications', description: 'Create and broadcast system notifications' },
  { key: 'notifications.send', module: 'notifications', description: 'Send direct alerts to customers or staff' },
  { key: 'notifications.manage', module: 'notifications', description: 'Configure automated notification triggers' },
  { key: 'audit_logs.view', module: 'audit', description: 'View security audit trail logs' },
  { key: 'audit_logs.export', module: 'audit', description: 'Export audit trail records to CSV' },
  { key: 'settings.view', module: 'settings', description: 'View ISP operational settings and policies' },
  { key: 'settings.edit', module: 'settings', description: 'Update ISP operational settings and policies' },
  { key: 'settings.appearance', module: 'settings', description: 'Manage system themes and appearance' },
  { key: 'settings.branding', module: 'settings', description: 'Manage ISP company name, logo and portal styling' },
];

export interface UserManagementItem {
  id: string;
  username: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  is_active: boolean;
  data_scope: 'PLATFORM' | 'ORGANIZATION' | 'HEAD_OFFICE' | 'BRANCH' | 'RESELLER' | 'OWN_RECORDS' | 'GLOBAL' | 'OWN';
  user_type: string;
  organization_id: number | null;
  branch_id: number | null;
  reseller_id: number | null;
  organization_name?: string | null;
  branch_name?: string | null;
  reseller_name?: string | null;
  roles: Array<{ id: number; name: string; display_name: string }>;
  role_name?: string;
  role_display_name?: string;
  last_login_at: string | null;
  last_login_ip: string | null;
  force_password_reset: boolean;
  token_version: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoleItem {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  can_edit?: boolean;
  is_developer_only?: boolean;
  user_count?: number;
  permission_count?: number;
  permissions?: string[];
  users?: Array<{ id: string; username: string; full_name: string | null; email: string | null; status: string }>;
  created_at: string;
  updated_at: string;
}

export interface PermissionItem {
  id: number;
  key: string;
  module: string;
  description: string | null;
}

export interface LoginHistoryItem {
  id: number;
  user_id: string | null;
  username: string;
  ip_address: string | null;
  user_agent: string | null;
  status: 'SUCCESS' | 'FAILED' | 'LOCKED';
  failure_reason: string | null;
  created_at: string;
}

export interface UserSessionItem {
  id: string;
  user_id: string;
  username?: string;
  full_name?: string | null;
  ip_address: string | null;
  user_agent: string | null;
  last_activity: string;
  expires_at: string | null;
  is_revoked: boolean;
  created_at: string;
}

export const userManagementRepository = {
  /** List all staff users with filters, search, and pagination */
  async listUsers(
    params: {
      search?: string;
      role?: string;
      status?: string;
      data_scope?: string;
      organization_id?: number;
      branch_id?: number;
      reseller_id?: number;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'ASC' | 'DESC';
    },
    actor?: AuthSession
  ): Promise<{ users: UserManagementItem[]; total: number; page: number; limit: number; totalPages: number; stats?: { total: number; active: number; suspended: number } }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

    const baseConditions: string[] = ['1=1', 'u.deleted_at IS NULL'];
    const baseValues: any[] = [];
    let baseIdx = 1;

    // Scope Restriction: Non-super_admin CANNOT view Developer Super Admin users
    if (!isSuperAdmin(actor)) {
      baseConditions.push(`NOT EXISTS (
        SELECT 1 FROM user_roles ur_sa
        JOIN roles r_sa ON r_sa.id = ur_sa.role_id
        WHERE ur_sa.user_id = u.id AND r_sa.name = 'super_admin'
      )`);
      baseConditions.push(`(u.role_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM roles r_sa WHERE r_sa.id = u.role_id AND r_sa.name = 'super_admin'
      ))`);

      // Branch users can only view their own branch
      if (isBranchUser(actor)) {
        baseConditions.push(`u.branch_id = $${baseIdx}`);
        baseValues.push(actor?.branchId || -1);
        baseIdx++;
      } else if (isResellerUser(actor)) {
        // Reseller users can only view their own reseller
        baseConditions.push(`u.reseller_id = $${baseIdx}`);
        baseValues.push(actor?.resellerId || -1);
        baseIdx++;
      } else if (actor?.organizationId) {
        // ISP Admin scoped to own organization
        baseConditions.push(`(u.organization_id = $${baseIdx} OR u.organization_id IS NULL)`);
        baseValues.push(actor.organizationId);
        baseIdx++;
      }
    }

    const conditions: string[] = [...baseConditions];
    const values: any[] = [...baseValues];
    let idx = baseIdx;

    if (params.search && params.search.trim()) {
      const q = `%${params.search.trim()}%`;
      conditions.push(`(u.username ILIKE $${idx} OR u.email ILIKE $${idx} OR u.full_name ILIKE $${idx} OR u.phone ILIKE $${idx})`);
      values.push(q);
      idx++;
    }

    if (params.status && params.status !== 'all') {
      conditions.push(`u.status = $${idx}`);
      values.push(params.status.toUpperCase());
      idx++;
    }

    if (params.data_scope && params.data_scope !== 'all') {
      conditions.push(`u.data_scope = $${idx}`);
      values.push(params.data_scope.toUpperCase());
      idx++;
    }

    if (params.organization_id && isSuperAdmin(actor)) {
      conditions.push(`u.organization_id = $${idx}`);
      values.push(params.organization_id);
      idx++;
    }

    if (params.branch_id && !isBranchUser(actor)) {
      conditions.push(`u.branch_id = $${idx}`);
      values.push(params.branch_id);
      idx++;
    }

    if (params.reseller_id && !isResellerUser(actor)) {
      conditions.push(`u.reseller_id = $${idx}`);
      values.push(params.reseller_id);
      idx++;
    }

    if (params.role && params.role !== 'all') {
      conditions.push(`(
        EXISTS (
          SELECT 1 FROM user_roles ur2
          JOIN roles r2 ON r2.id = ur2.role_id
          WHERE ur2.user_id = u.id AND (r2.name = $${idx} OR r2.id::text = $${idx})
        ) OR EXISTS (
          SELECT 1 FROM roles r2
          WHERE r2.id = u.role_id AND (r2.name = $${idx} OR r2.id::text = $${idx})
        )
      )`);
      values.push(params.role);
      idx++;
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM users u WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const baseWhereClause = baseConditions.join(' AND ');
    const statsRes = await query<{ total: string; active: string; suspended: string }>(
      `SELECT COUNT(*)::text as total,
              COUNT(*) FILTER (WHERE COALESCE(u.status, 'ACTIVE') = 'ACTIVE')::text as active,
              COUNT(*) FILTER (WHERE u.status = 'SUSPENDED')::text as suspended
       FROM users u WHERE ${baseWhereClause}`,
      baseValues
    );
    const stats = {
      total: parseInt(statsRes.rows[0]?.total || '0', 10),
      active: parseInt(statsRes.rows[0]?.active || '0', 10),
      suspended: parseInt(statsRes.rows[0]?.suspended || '0', 10),
    };

    const validSortCols: Record<string, string> = {
      username: 'u.username',
      full_name: 'u.full_name',
      status: 'u.status',
      created_at: 'u.created_at',
      last_login_at: 'u.last_login_at',
    };
    const sortCol = params.sortBy && validSortCols[params.sortBy] ? validSortCols[params.sortBy] : 'u.created_at';
    const sortDir = params.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const dataQuery = `
      SELECT u.id, u.username, u.email, u.full_name, u.phone, u.notes,
             COALESCE(u.status, 'ACTIVE') AS status,
             u.is_active,
             COALESCE(u.data_scope, 'OWN') AS data_scope,
             COALESCE(u.user_type, 'isp') AS user_type,
             u.organization_id, u.branch_id, u.reseller_id,
             org.name AS organization_name,
             b.name AS branch_name,
             res.name AS reseller_name,
             u.last_login_at, u.last_login_ip,
             u.force_password_reset,
             COALESCE(u.token_version, 1) AS token_version,
             u.created_at, u.updated_at,
             (
               SELECT COALESCE(
                 json_agg(json_build_object('id', r.id, 'name', r.name, 'display_name', r.display_name)),
                 '[]'::json
               )
               FROM roles r
               WHERE r.id = u.role_id
                  OR r.id IN (SELECT ur.role_id FROM user_roles ur WHERE ur.user_id = u.id)
             ) AS roles
        FROM users u
   LEFT JOIN organizations org ON org.id = u.organization_id
   LEFT JOIN branches b ON b.id = u.branch_id
   LEFT JOIN resellers res ON res.id = u.reseller_id
       WHERE ${whereClause}
    ORDER BY ${sortCol} ${sortDir}
       LIMIT $${idx} OFFSET $${idx + 1}
    `;

    values.push(limit, offset);
    const { rows } = await query<any>(dataQuery, values);

    const users: UserManagementItem[] = rows.map((r) => {
      const parsedRoles = Array.isArray(r.roles) ? r.roles : [];
      return {
        id: r.id,
        username: r.username,
        email: r.email,
        full_name: r.full_name,
        phone: r.phone,
        notes: r.notes || null,
        status: r.status,
        is_active: r.is_active,
        data_scope: r.data_scope,
        user_type: r.user_type,
        organization_id: r.organization_id,
        branch_id: r.branch_id,
        reseller_id: r.reseller_id,
        organization_name: r.organization_name,
        branch_name: r.branch_name,
        reseller_name: r.reseller_name,
        roles: parsedRoles,
        role_name: parsedRoles[0]?.name || 'N/A',
        role_display_name: parsedRoles[0]?.display_name || 'Unassigned',
        last_login_at: r.last_login_at ? new Date(r.last_login_at).toISOString() : null,
        last_login_ip: r.last_login_ip,
        force_password_reset: !!r.force_password_reset,
        token_version: r.token_version,
        created_at: new Date(r.created_at).toISOString(),
        updated_at: new Date(r.updated_at).toISOString(),
      };
    });

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      stats,
    };
  },

  /** Get detailed single user with permissions union */
  async getUserById(id: string, actor?: AuthSession): Promise<UserManagementItem & { permissions: string[] }> {
    const dataQuery = `
      SELECT u.id, u.username, u.email, u.full_name, u.phone, u.notes,
             COALESCE(u.status, 'ACTIVE') AS status,
             u.is_active,
             COALESCE(u.data_scope, 'OWN') AS data_scope,
             COALESCE(u.user_type, 'isp') AS user_type,
             u.organization_id, u.branch_id, u.reseller_id,
             org.name AS organization_name,
             b.name AS branch_name,
             res.name AS reseller_name,
             u.last_login_at, u.last_login_ip,
             u.force_password_reset,
             COALESCE(u.token_version, 1) AS token_version,
             u.created_at, u.updated_at,
             (
               SELECT COALESCE(
                 json_agg(json_build_object('id', r.id, 'name', r.name, 'display_name', r.display_name)),
                 '[]'::json
               )
               FROM roles r
               WHERE r.id = u.role_id
                  OR r.id IN (SELECT ur.role_id FROM user_roles ur WHERE ur.user_id = u.id)
             ) AS roles
        FROM users u
   LEFT JOIN organizations org ON org.id = u.organization_id
   LEFT JOIN branches b ON b.id = u.branch_id
   LEFT JOIN resellers res ON res.id = u.reseller_id
       WHERE u.id = $1 AND u.deleted_at IS NULL
    `;

    const { rows } = await query<any>(dataQuery, [id]);
    if (!rows[0]) {
      throw HttpError.notFound('User not found');
    }

    const r = rows[0];
    const parsedRoles = Array.isArray(r.roles) ? r.roles : [];

    // Hide Developer Super Admin user from non-super_admin actors
    const isTargetSuperAdmin = parsedRoles.some((ro: any) => ro.name === 'super_admin');
    if (isTargetSuperAdmin && !isSuperAdmin(actor)) {
      throw HttpError.notFound('User not found');
    }

    // Verify actor can manage/view target user
    if (actor) {
      assertCanManageUser(actor, {
        role_name: parsedRoles[0]?.name,
        roles: parsedRoles,
        branch_id: r.branch_id,
        reseller_id: r.reseller_id,
        organization_id: r.organization_id,
      });
    }

    // Fetch unified permissions across all assigned roles
    const permRes = await query<{ key: string }>(
      `SELECT DISTINCT p.key
         FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id IN (
          SELECT role_id FROM user_roles WHERE user_id = $1
          UNION
          SELECT role_id FROM users WHERE id = $1 AND role_id IS NOT NULL
        )
        ORDER BY p.key`,
      [id]
    );

    return {
      id: r.id,
      username: r.username,
      email: r.email,
      full_name: r.full_name,
      phone: r.phone,
      notes: r.notes || null,
      status: r.status,
      is_active: r.is_active,
      data_scope: r.data_scope,
      user_type: r.user_type,
      organization_id: r.organization_id,
      branch_id: r.branch_id,
      reseller_id: r.reseller_id,
      organization_name: r.organization_name,
      branch_name: r.branch_name,
      reseller_name: r.reseller_name,
      roles: parsedRoles,
      role_name: parsedRoles[0]?.name || 'N/A',
      role_display_name: parsedRoles[0]?.display_name || 'Unassigned',
      permissions: permRes.rows.map((p) => p.key),
      last_login_at: r.last_login_at ? new Date(r.last_login_at).toISOString() : null,
      last_login_ip: r.last_login_ip,
      force_password_reset: !!r.force_password_reset,
      token_version: r.token_version,
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    };
  },

  /** Create a new staff user with multi-role assignments & dynamic scope adaptation */
  async createUser(
    input: {
      username: string;
      email?: string;
      fullName: string;
      phone?: string;
      password: string;
      roleIds: number[];
      dataScope?: 'PLATFORM' | 'ORGANIZATION' | 'HEAD_OFFICE' | 'BRANCH' | 'RESELLER' | 'OWN_RECORDS' | 'GLOBAL' | 'OWN';
      userType?: 'isp' | 'branch' | 'reseller';
      organizationId?: number;
      branchId?: number;
      resellerId?: number;
      forcePasswordReset?: boolean;
      notes?: string;
      createdBy?: string;
    },
    actor?: AuthSession
  ): Promise<string> {
    const trimmedUsername = input.username.trim();
    const trimmedEmail = input.email?.trim() || null;
    let existing;
    if (trimmedEmail) {
      existing = await query(
        'SELECT id FROM users WHERE lower(username) = lower($1) OR (email IS NOT NULL AND email != \'\' AND lower(email) = lower($2))',
        [trimmedUsername, trimmedEmail]
      );
    } else {
      existing = await query(
        'SELECT id FROM users WHERE lower(username) = lower($1)',
        [trimmedUsername]
      );
    }
    if (existing.rows.length > 0) {
      throw HttpError.badRequest('Username or email already in use');
    }

    if (!input.password || input.password.length < 6) {
      throw HttpError.badRequest('Password must be at least 6 characters long');
    }

    if (!input.roleIds || input.roleIds.length === 0) {
      throw HttpError.badRequest('At least one role must be assigned to the user');
    }

    // Validate role permissions & active status
    const roleRows = await query<{ id: number; name: string; display_name: string; is_active: boolean }>(
      'SELECT id, name, display_name, COALESCE(is_active, TRUE) as is_active FROM roles WHERE id = ANY($1::int[])',
      [input.roleIds]
    );

    if (roleRows.rows.length !== input.roleIds.length) {
      throw HttpError.badRequest('One or more selected roles do not exist');
    }

    for (const r of roleRows.rows) {
      if (!r.is_active) {
        throw HttpError.badRequest(`Role "${r.display_name}" is disabled and cannot be assigned`);
      }
      assertCanAssignRole(actor, r.name);
    }

    // Dynamic role hierarchy checks
    const hasBranchManagerRole = roleRows.rows.some((r) => r.name === 'branch_manager');
    const isBranchRole = roleRows.rows.some((r) => r.name === 'branch_admin' || r.name === 'branch_operator');
    const isResellerRole = roleRows.rows.some((r) => r.name === 'reseller_admin' || r.name === 'reseller_operator');

    let branchId = input.branchId;
    let resellerId = input.resellerId;
    let userType = input.userType;
    let dataScope = input.dataScope;

    if (hasBranchManagerRole) {
      if (branchId && resellerId) {
        throw HttpError.badRequest('Branch Manager cannot be assigned to both a Branch and a Reseller');
      }
      if (!branchId && !resellerId) {
        throw HttpError.badRequest('Branch Manager must be explicitly assigned to either a Branch or a Reseller');
      }
      if (branchId) {
        userType = 'branch';
        resellerId = undefined;
        if (!dataScope || dataScope === 'GLOBAL' || dataScope === 'PLATFORM' || dataScope === 'ORGANIZATION') {
          dataScope = 'BRANCH';
        }
      } else {
        userType = 'reseller';
        branchId = undefined;
        if (!dataScope || dataScope === 'GLOBAL' || dataScope === 'PLATFORM' || dataScope === 'ORGANIZATION') {
          dataScope = 'RESELLER';
        }
      }
    } else if (isBranchRole && isResellerRole) {
      throw HttpError.badRequest('A user cannot simultaneously hold both Branch and Reseller roles');
    } else if (isBranchRole) {
      if (!branchId) {
        throw HttpError.badRequest('Branch assignment is required for branch roles');
      }
      if (resellerId) {
        throw HttpError.badRequest('Reseller must not be assigned to a branch role');
      }
      userType = 'branch';
      if (!dataScope || dataScope === 'GLOBAL' || dataScope === 'PLATFORM') {
        dataScope = 'BRANCH';
      }
    } else if (isResellerRole) {
      if (!resellerId) {
        throw HttpError.badRequest('Reseller assignment is required for reseller roles');
      }
      if (branchId) {
        throw HttpError.badRequest('A reseller is an independent entity and must not be assigned under a branch');
      }
      userType = 'reseller';
      if (!dataScope || dataScope === 'GLOBAL' || dataScope === 'PLATFORM') {
        dataScope = 'RESELLER';
      }
    } else {
      // Organization / ISP / Head Office roles: Neither branch nor reseller
      userType = userType || 'isp';
      if (!dataScope || dataScope === 'GLOBAL') {
        dataScope = 'ORGANIZATION';
      }
      branchId = undefined;
      resellerId = undefined;
    }

    if (dataScope === 'PLATFORM' && !isSuperAdmin(actor)) {
      throw HttpError.forbidden('Only Developer Super Admin can assign PLATFORM data scope');
    }

    // Organization resolution
    let orgId = input.organizationId;
    if (!isSuperAdmin(actor)) {
      orgId = actor?.organizationId || 1;
    } else if (!orgId) {
      orgId = 1;
    }

    // Actor boundary enforcement
    if (isBranchUser(actor)) {
      branchId = actor?.branchId || undefined;
      if (dataScope === 'PLATFORM' || dataScope === 'ORGANIZATION') {
        dataScope = 'BRANCH';
      }
    } else if (isResellerUser(actor)) {
      resellerId = actor?.resellerId || undefined;
      if (dataScope === 'PLATFORM' || dataScope === 'ORGANIZATION') {
        dataScope = 'RESELLER';
      }
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const client = await getClient();

    try {
      await client.query('BEGIN');

      const primaryRoleId = input.roleIds[0];

      const userRes = await client.query<{ id: string }>(
        `INSERT INTO users (
           username, email, full_name, phone, password_hash,
           role_id, status, is_active, data_scope, user_type,
           organization_id, branch_id, reseller_id,
           force_password_reset, notes, created_by, updated_by
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, 'ACTIVE', TRUE, $7, $8,
           $9, $10, $11,
           $12, $13, $14, $14
         ) RETURNING id`,
        [
          input.username.trim(),
          input.email?.trim() || null,
          input.fullName.trim(),
          input.phone?.trim() || null,
          passwordHash,
          primaryRoleId,
          dataScope || 'OWN',
          userType || 'isp',
          orgId,
          branchId || null,
          resellerId || null,
          !!input.forcePasswordReset,
          input.notes?.trim() || null,
          input.createdBy || null,
        ]
      );

      const userId = userRes.rows[0].id;

      for (const roleId of input.roleIds) {
        await client.query(
          `INSERT INTO user_roles (user_id, role_id, assigned_by)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [userId, roleId, input.createdBy || null]
        );
      }

      await client.query('COMMIT');

      await auditRepository.insert({
        userId: input.createdBy,
        action: 'user.created',
        entityType: 'user',
        entityId: userId,
        status: 'success',
        metadata: {
          username: input.username,
          fullName: input.fullName,
          roles: input.roleIds,
          dataScope,
          branchId,
          resellerId,
        },
      });

      return userId;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /** Update staff user account with dynamic RBAC checks & session invalidation */
  async updateUser(
    id: string,
    input: {
      fullName?: string;
      email?: string;
      phone?: string;
      status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
      roleIds?: number[];
      dataScope?: 'PLATFORM' | 'ORGANIZATION' | 'HEAD_OFFICE' | 'BRANCH' | 'RESELLER' | 'OWN_RECORDS' | 'GLOBAL' | 'OWN';
      organizationId?: number | null;
      branchId?: number | null;
      resellerId?: number | null;
      userType?: 'isp' | 'branch' | 'reseller';
      forcePasswordReset?: boolean;
      notes?: string | null;
      updatedBy?: string;
    },
    actor?: AuthSession
  ): Promise<void> {
    const target = await this.getUserById(id, actor);

    // Validate role assignments if updating roles
    let roleChanged = false;
    if (input.roleIds && input.roleIds.length > 0) {
      const roleRows = await query<{ id: number; name: string; display_name: string; is_active: boolean }>(
        'SELECT id, name, display_name, COALESCE(is_active, TRUE) as is_active FROM roles WHERE id = ANY($1::int[])',
        [input.roleIds]
      );

      if (roleRows.rows.length !== input.roleIds.length) {
        throw HttpError.badRequest('One or more selected roles do not exist');
      }

      for (const r of roleRows.rows) {
        if (!r.is_active) {
          throw HttpError.badRequest(`Role "${r.display_name}" is disabled and cannot be assigned`);
        }
        assertCanAssignRole(actor, r.name);
      }

      const hasBranchManagerRole = roleRows.rows.some((r) => r.name === 'branch_manager');
      const isBranchRole = roleRows.rows.some((r) => r.name === 'branch_admin' || r.name === 'branch_operator');
      const isResellerRole = roleRows.rows.some((r) => r.name === 'reseller_admin' || r.name === 'reseller_operator');

      if (hasBranchManagerRole) {
        let effectiveBranchId = input.branchId !== undefined ? input.branchId : target.branch_id;
        let effectiveResellerId = input.resellerId !== undefined ? input.resellerId : target.reseller_id;

        // If user changed type explicitly
        if (input.userType === 'branch') {
          effectiveResellerId = null;
          input.resellerId = null;
        } else if (input.userType === 'reseller') {
          effectiveBranchId = null;
          input.branchId = null;
        }

        if (effectiveBranchId && effectiveResellerId) {
          throw HttpError.badRequest('Branch Manager cannot be assigned to both a Branch and a Reseller');
        }
        if (!effectiveBranchId && !effectiveResellerId) {
          throw HttpError.badRequest('Branch Manager must be explicitly assigned to either a Branch or a Reseller');
        }

        if (effectiveBranchId) {
          input.branchId = effectiveBranchId;
          input.resellerId = null;
          input.userType = 'branch';
          if (!input.dataScope || input.dataScope === 'GLOBAL' || input.dataScope === 'PLATFORM') {
            input.dataScope = 'BRANCH';
          }
        } else {
          input.resellerId = effectiveResellerId;
          input.branchId = null;
          input.userType = 'reseller';
          if (!input.dataScope || input.dataScope === 'GLOBAL' || input.dataScope === 'PLATFORM') {
            input.dataScope = 'RESELLER';
          }
        }
      } else if (isBranchRole && isResellerRole) {
        throw HttpError.badRequest('A user cannot simultaneously hold both Branch and Reseller roles');
      } else if (isBranchRole) {
        const effectiveBranchId = input.branchId !== undefined ? input.branchId : target.branch_id;
        if (!effectiveBranchId) {
          throw HttpError.badRequest('Branch assignment is required for branch roles');
        }
        input.resellerId = null;
        input.userType = 'branch';
      } else if (isResellerRole) {
        const effectiveResellerId = input.resellerId !== undefined ? input.resellerId : target.reseller_id;
        if (!effectiveResellerId) {
          throw HttpError.badRequest('Reseller assignment is required for reseller roles');
        }
        input.branchId = null;
        input.userType = 'reseller';
      }

      roleChanged = true;
    }

    if (input.dataScope === 'PLATFORM' && !isSuperAdmin(actor)) {
      throw HttpError.forbidden('Only Developer Super Admin can assign PLATFORM data scope');
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const isActive = input.status ? input.status === 'ACTIVE' : undefined;

      await client.query(
        `UPDATE users
            SET full_name = COALESCE($2, full_name),
                email = COALESCE($3, email),
                phone = COALESCE($4, phone),
                status = COALESCE($5, status),
                is_active = COALESCE($6, is_active),
                data_scope = COALESCE($7, data_scope),
                user_type = COALESCE($8, user_type),
                organization_id = CASE WHEN $9::text IS NOT NULL THEN $9::int ELSE organization_id END,
                branch_id = CASE WHEN $10::text IS NOT NULL THEN $10::int ELSE branch_id END,
                reseller_id = CASE WHEN $11::text IS NOT NULL THEN $11::int ELSE reseller_id END,
                force_password_reset = COALESCE($12, force_password_reset),
                notes = CASE WHEN $13::text IS NOT NULL THEN $13 ELSE notes END,
                updated_by = $14,
                updated_at = NOW()
          WHERE id = $1`,
        [
          id,
          input.fullName?.trim() || null,
          input.email?.trim() || null,
          input.phone?.trim() || null,
          input.status || null,
          isActive !== undefined ? isActive : null,
          input.dataScope || null,
          input.userType || null,
          input.organizationId !== undefined ? (input.organizationId ? String(input.organizationId) : null) : null,
          input.branchId !== undefined ? (input.branchId ? String(input.branchId) : null) : null,
          input.resellerId !== undefined ? (input.resellerId ? String(input.resellerId) : null) : null,
          input.forcePasswordReset !== undefined ? input.forcePasswordReset : null,
          input.notes !== undefined ? input.notes : null,
          input.updatedBy || null,
        ]
      );

      // Re-sync user_roles if provided
      if (input.roleIds && input.roleIds.length > 0) {
        await client.query('DELETE FROM user_roles WHERE user_id = $1', [id]);
        for (const roleId of input.roleIds) {
          await client.query(
            `INSERT INTO user_roles (user_id, role_id, assigned_by)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [id, roleId, input.updatedBy || null]
          );
        }
        await client.query('UPDATE users SET role_id = $2 WHERE id = $1', [id, input.roleIds[0]]);
      }

      // Security: Invalidate active sessions and bump token version on role change or status deactivation
      const statusChanged = input.status && input.status !== target.status;
      if (roleChanged || (statusChanged && input.status !== 'ACTIVE')) {
        await client.query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [id]);
        await client.query('UPDATE login_sessions SET is_revoked = TRUE WHERE user_id = $1', [id]);
      }

      await client.query('COMMIT');

      await auditRepository.insert({
        userId: input.updatedBy,
        action: 'user.updated',
        entityType: 'user',
        entityId: id,
        status: 'success',
        metadata: { updatedFields: Object.keys(input), roleChanged, statusChanged },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /** Reset user password with session invalidation */
  async resetPassword(id: string, newPass: string, forceNextReset = false, changedBy?: string, actor?: AuthSession): Promise<void> {
    const target = await this.getUserById(id, actor);
    if (!newPass || newPass.length < 6) {
      throw HttpError.badRequest('Password must be at least 6 characters long');
    }
    const hash = await bcrypt.hash(newPass, 10);
    await query(
      `UPDATE users
          SET password_hash = $2,
              password_changed_at = NOW(),
              force_password_reset = $3,
              token_version = token_version + 1,
              updated_by = $4,
              updated_at = NOW()
        WHERE id = $1`,
      [id, hash, forceNextReset, changedBy || null]
    );

    // Invalidate active sessions
    await query('UPDATE login_sessions SET is_revoked = TRUE WHERE user_id = $1', [id]);

    await auditRepository.insert({
      userId: changedBy,
      action: 'user.password_reset',
      entityType: 'user',
      entityId: id,
      status: 'success',
      metadata: { username: target.username, forceNextReset },
    });
  },

  /** Force logout: terminates active sessions and bumps token version */
  async forceLogout(id: string, actorId?: string, actor?: AuthSession): Promise<void> {
    await this.getUserById(id, actor);

    await query(
      `UPDATE users
          SET token_version = token_version + 1,
              updated_at = NOW()
        WHERE id = $1`,
      [id]
    );

    await query('UPDATE login_sessions SET is_revoked = TRUE WHERE user_id = $1', [id]);

    await auditRepository.insert({
      userId: actorId,
      action: 'user.force_logout',
      entityType: 'user',
      entityId: id,
      status: 'success',
    });
  },

  /** Toggle user status (ACTIVE, INACTIVE, SUSPENDED) */
  async setStatus(id: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED', actorId?: string, actor?: AuthSession): Promise<void> {
    await this.getUserById(id, actor);
    const isActive = status === 'ACTIVE';

    await query(
      `UPDATE users
          SET status = $2,
              is_active = $3,
              updated_by = $4,
              updated_at = NOW()
        WHERE id = $1`,
      [id, status, isActive, actorId || null]
    );

    if (status !== 'ACTIVE') {
      await this.forceLogout(id, actorId, actor);
    }

    await auditRepository.insert({
      userId: actorId,
      action: `user.status_${status.toLowerCase()}`,
      entityType: 'user',
      entityId: id,
      status: 'success',
    });
  },

  /** Delete user with safety guards, scope check, and hard/soft deletion */
  async deleteUser(id: string, actor?: AuthSession): Promise<void> {
    const target = await this.getUserById(id, actor);
    if (!target) throw HttpError.notFound('User not found');

    // 1. Self-deletion guard
    if (actor?.userId && String(actor.userId) === String(id)) {
      throw HttpError.badRequest('You cannot delete your own account');
    }

    // 2. Super Admin deletion guards
    const targetIsSuperAdmin = target.role_name === 'super_admin' || (target.roles && (target.roles as any[]).some((r: any) => r.name === 'super_admin'));
    if (targetIsSuperAdmin) {
      if (!isSuperAdmin(actor)) {
        throw HttpError.forbidden('Only Super Admin can delete a Super Admin user');
      }
      const saCountRes = await query<{ count: string }>(`
        SELECT COUNT(DISTINCT u.id)::int AS count
          FROM users u
          JOIN roles r ON r.id = u.role_id
         WHERE r.name = 'super_admin'
           AND u.id != $1
           AND u.deleted_at IS NULL
           AND u.is_active = TRUE
      `, [id]);
      const remainingSa = parseInt(saCountRes.rows[0]?.count || '0', 10);
      if (remainingSa <= 0) {
        throw HttpError.badRequest('Cannot delete the last remaining active Super Admin');
      }
    }

    // 3. Last Admin guard within organization
    const targetIsAdmin = targetIsSuperAdmin || target.role_name === 'organization_admin' || target.role_name === 'admin';
    if (targetIsAdmin) {
      const adminCountRes = await query<{ count: string }>(`
        SELECT COUNT(DISTINCT u.id)::int AS count
          FROM users u
          JOIN roles r ON r.id = u.role_id
         WHERE r.name IN ('super_admin', 'organization_admin', 'admin')
           AND u.id != $1
           AND u.deleted_at IS NULL
           AND u.is_active = TRUE
           AND (u.organization_id = $2 OR u.organization_id IS NULL)
      `, [id, target.organization_id || null]);
      const remainingAdmins = parseInt(adminCountRes.rows[0]?.count || '0', 10);
      if (remainingAdmins <= 0) {
        throw HttpError.badRequest('Cannot delete the last remaining administrator');
      }
    }

    // 4. Data Scope Guard
    if (isBranchUser(actor)) {
      if (target.branch_id !== actor?.branchId) {
        throw HttpError.forbidden('Branch Managers cannot delete users outside their assigned branch');
      }
    } else if (isResellerUser(actor)) {
      if (target.reseller_id !== actor?.resellerId) {
        throw HttpError.forbidden('Resellers cannot delete users outside their assigned reseller');
      }
    } else if (actor?.organizationId && !isSuperAdmin(actor)) {
      if (target.organization_id && target.organization_id !== actor.organizationId) {
        throw HttpError.forbidden('ISP Admins can only delete staff users within their organization');
      }
    }

    // 5. Invalidate sessions
    await this.forceLogout(id, actor?.userId, actor).catch(() => undefined);

    // 6. Check historical records to decide Hard Delete vs Soft Delete
    const [tktRes, comRes, auditRes, leadRes, recRes] = await Promise.all([
      query<{ count: string }>('SELECT COUNT(*)::int AS count FROM tickets WHERE created_by_id = $1 OR assigned_user_id = $1', [id]).catch(() => ({ rows: [{ count: '0' }] })),
      query<{ count: string }>('SELECT COUNT(*)::int AS count FROM ticket_comments WHERE author_id = $1', [id]).catch(() => ({ rows: [{ count: '0' }] })),
      query<{ count: string }>('SELECT COUNT(*)::int AS count FROM audit_logs WHERE actor_id = $1 OR actor = $2', [id, target.username]).catch(() => ({ rows: [{ count: '0' }] })),
      query<{ count: string }>('SELECT COUNT(*)::int AS count FROM lead_activities WHERE author_id = $1', [id]).catch(() => ({ rows: [{ count: '0' }] })),
      query<{ count: string }>('SELECT COUNT(*)::int AS count FROM recharge_transactions WHERE created_by = $1', [target.username]).catch(() => ({ rows: [{ count: '0' }] })),
    ]);

    const historyCount =
      parseInt(tktRes.rows[0]?.count || '0', 10) +
      parseInt(comRes.rows[0]?.count || '0', 10) +
      parseInt(auditRes.rows[0]?.count || '0', 10) +
      parseInt(leadRes.rows[0]?.count || '0', 10) +
      parseInt(recRes.rows[0]?.count || '0', 10);

    const client = await getClient();
    try {
      await client.query('BEGIN');
      if (historyCount > 0) {
        // Soft delete: set deleted_at, randomize password hash, mark inactive
        const randomizedHash = `$deleted$${crypto.randomBytes(24).toString('hex')}`;
        await client.query(`
          UPDATE users
             SET deleted_at = NOW(),
                 is_active = FALSE,
                 status = 'DELETED',
                 password_hash = $1,
                 token_version = token_version + 1,
                 updated_at = NOW()
           WHERE id = $2
        `, [randomizedHash, id]);
      } else {
        // Clean user with no historical references: Hard delete cleanly
        await client.query('DELETE FROM user_roles WHERE user_id = $1', [id]);
        await client.query('DELETE FROM user_preferences WHERE user_id = $1', [id]).catch(() => undefined);
        await client.query('DELETE FROM login_sessions WHERE user_id = $1', [id]).catch(() => undefined);
        await client.query('DELETE FROM users WHERE id = $1', [id]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await auditRepository.insert({
      action: 'user.delete',
      entityType: 'user',
      entityId: String(id),
      username: actor?.username || 'admin',
      userId: actor?.userId ? String(actor.userId) : null,
      status: 'success',
      metadata: { username: target.username, softDeleted: historyCount > 0 },
    }).catch(() => undefined);
  },

  /** List user login history for a specific user */
  async getLoginHistory(userId: string, limit = 50, actor?: AuthSession): Promise<LoginHistoryItem[]> {
    await this.getUserById(userId, actor);
    const { rows } = await query<any>(
      `SELECT id, user_id, username, ip_address::text, user_agent, status, failure_reason, created_at
         FROM login_history
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [userId, limit]
    );
    return rows.map((r) => ({
      ...r,
      created_at: new Date(r.created_at).toISOString(),
    }));
  },

  /** List all login history across users with search, status filter, and pagination */
  async listAllLoginHistory(
    params: {
      search?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
    actor?: AuthSession
  ): Promise<{ history: LoginHistoryItem[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const values: any[] = [];
    let idx = 1;

    // Non-super admin cannot see Super Admin login records
    if (!isSuperAdmin(actor)) {
      conditions.push(`lh.user_id NOT IN (
        SELECT ur_sa.user_id FROM user_roles ur_sa
        JOIN roles r_sa ON r_sa.id = ur_sa.role_id
        WHERE r_sa.name = 'super_admin'
      )`);
    }

    if (params.search && params.search.trim()) {
      const q = `%${params.search.trim()}%`;
      conditions.push(`(lh.username ILIKE $${idx} OR lh.ip_address::text ILIKE $${idx})`);
      values.push(q);
      idx++;
    }

    if (params.status && params.status !== 'all') {
      conditions.push(`lh.status = $${idx}`);
      values.push(params.status.toUpperCase());
      idx++;
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM login_history lh WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const dataQuery = `
      SELECT lh.id, lh.user_id, lh.username, lh.ip_address::text, lh.user_agent, lh.status, lh.failure_reason, lh.created_at
        FROM login_history lh
       WHERE ${whereClause}
       ORDER BY lh.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}
    `;
    values.push(limit, offset);

    const { rows } = await query<any>(dataQuery, values);
    const history: LoginHistoryItem[] = rows.map((r) => ({
      ...r,
      created_at: new Date(r.created_at).toISOString(),
    }));

    return {
      history,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  /** List active login sessions for a specific user */
  async getSessions(userId: string, actor?: AuthSession): Promise<UserSessionItem[]> {
    await this.getUserById(userId, actor);
    const { rows } = await query<any>(
      `SELECT id, user_id, ip_address::text, user_agent, last_activity, expires_at, is_revoked, created_at
         FROM login_sessions
        WHERE user_id = $1
        ORDER BY last_activity DESC
        LIMIT 20`,
      [userId]
    );
    return rows.map((r) => ({
      ...r,
      last_activity: new Date(r.last_activity).toISOString(),
      expires_at: r.expires_at ? new Date(r.expires_at).toISOString() : null,
      created_at: new Date(r.created_at).toISOString(),
    }));
  },

  /** List all active user sessions across the system */
  async listAllSessions(
    params: {
      search?: string;
      isRevoked?: boolean;
      page?: number;
      limit?: number;
    },
    actor?: AuthSession
  ): Promise<{ sessions: UserSessionItem[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const values: any[] = [];
    let idx = 1;

    // Scope: Non-super_admin cannot see Developer Super Admin sessions
    if (!isSuperAdmin(actor)) {
      conditions.push(`ls.user_id NOT IN (
        SELECT ur_sa.user_id FROM user_roles ur_sa
        JOIN roles r_sa ON r_sa.id = ur_sa.role_id
        WHERE r_sa.name = 'super_admin'
      )`);
    }

    if (params.search && params.search.trim()) {
      const q = `%${params.search.trim()}%`;
      conditions.push(`(u.username ILIKE $${idx} OR u.full_name ILIKE $${idx} OR ls.ip_address::text ILIKE $${idx})`);
      values.push(q);
      idx++;
    }

    if (params.isRevoked !== undefined) {
      conditions.push(`ls.is_revoked = $${idx}`);
      values.push(params.isRevoked);
      idx++;
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count
         FROM login_sessions ls
         JOIN users u ON u.id = ls.user_id
        WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const dataQuery = `
      SELECT ls.id, ls.user_id, u.username, u.full_name, ls.ip_address::text, ls.user_agent,
             ls.last_activity, ls.expires_at, ls.is_revoked, ls.created_at
        FROM login_sessions ls
        JOIN users u ON u.id = ls.user_id
       WHERE ${whereClause}
       ORDER BY ls.last_activity DESC
       LIMIT $${idx} OFFSET $${idx + 1}
    `;
    values.push(limit, offset);

    const { rows } = await query<any>(dataQuery, values);
    const sessions: UserSessionItem[] = rows.map((r) => ({
      ...r,
      last_activity: new Date(r.last_activity).toISOString(),
      expires_at: r.expires_at ? new Date(r.expires_at).toISOString() : null,
      created_at: new Date(r.created_at).toISOString(),
    }));

    return {
      sessions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  /** Revoke an individual session */
  async revokeSession(sessionId: string, actor?: AuthSession): Promise<void> {
    const sessionRes = await query<{ user_id: string }>(
      'SELECT user_id FROM login_sessions WHERE id = $1',
      [sessionId]
    );
    if (!sessionRes.rows[0]) {
      throw HttpError.notFound('Session not found');
    }

    await this.getUserById(sessionRes.rows[0].user_id, actor);

    await query('UPDATE login_sessions SET is_revoked = TRUE WHERE id = $1', [sessionId]);

    await auditRepository.insert({
      userId: actor?.userId,
      action: 'session.revoked',
      entityType: 'session',
      entityId: sessionId,
      status: 'success',
    });
  },

  // ---------------------------------------------------------------------------
  //  ROLES & PERMISSIONS
  // ---------------------------------------------------------------------------

  /**
   * Idempotent initialization of default roles & granular operational permissions.
   * Guaranteed to run without creating duplicate roles or breaking customizations.
   */
  async ensureDefaultRoles(): Promise<void> {
    // 1. Ensure all permissions from PERMISSION_CATALOG are registered in permissions table
    for (const perm of PERMISSION_CATALOG) {
      await query(
        `INSERT INTO permissions (key, module, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET
           module = EXCLUDED.module,
           description = EXCLUDED.description`,
        [perm.key, perm.module, perm.description]
      );
    }

    // 2. Ensure the 3 default roles exist with stable internal identifiers
    await query(`
      INSERT INTO roles (name, display_name, description, is_system, is_active)
      VALUES
        ('super_admin',    'Super Admin — Developer', 'Software developer & platform owner with full technical diagnostics and platform configuration', TRUE, TRUE),
        ('isp_admin',      'ISP Admin',               'ISP owner and senior operational administrator with full control over ISP organization and operations', TRUE, TRUE),
        ('branch_manager', 'Branch Manager',          'Manages daily operations for one assigned branch or one assigned reseller', TRUE, TRUE)
      ON CONFLICT (name) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        description = EXCLUDED.description,
        is_system = TRUE,
        is_active = TRUE
    `);

    // 3. Grant all permissions to super_admin
    await query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
        FROM roles r, permissions p
       WHERE r.name = 'super_admin'
      ON CONFLICT DO NOTHING
    `);

    // 4. Grant operational permissions to isp_admin (excluding developer/system permissions)
    await query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
        FROM roles r, permissions p
       WHERE r.name = 'isp_admin'
         AND p.key NOT IN (
           'system.developer_config',
           'system.diagnostics',
           'system.database_tools',
           'platform.organizations.manage'
         )
         AND p.module != 'system'
      ON CONFLICT DO NOTHING
    `);

    // 5. Grant branch & reseller operational permissions to branch_manager
    await query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
        FROM roles r, permissions p
       WHERE r.name = 'branch_manager'
         AND p.key IN (
           'dashboard.view',
           'subscriber.view', 'subscriber.create', 'subscriber.edit',
           'subscriber.activate', 'subscriber.suspend', 'subscriber.resume',
           'subscriber.recharge', 'subscriber.change_package',
           'package.view',
           'billing.view', 'billing.recharge', 'billing.invoice', 'billing.receipt',
           'branch.view', 'branch.report',
           'reseller.view', 'reseller.report', 'reseller.wallet.view', 'reseller.credit.view',
           'wallet.view', 'wallet.report',
           'tickets.view', 'tickets.create', 'tickets.edit', 'tickets.assign', 'tickets.comment', 'tickets.close',
           'crm.view', 'crm.create', 'crm.edit',
           'sessions.view',
           'accounting.view',
           'notifications.view',
           'olt.view',
           'olt.view_optical',
           'olt.discover',
           'olt.register_onu',
           'olt.sync',
           'olt.view_history'
         )
      ON CONFLICT DO NOTHING
    `);
  },

  /** List all roles with member counts, permission count, and developer flags (Super Admin hidden for non-developers) */
  async listRoles(actor?: AuthSession): Promise<RoleItem[]> {
    const isDev = isSuperAdmin(actor);
    const filterClause = !isDev ? "WHERE r.name != 'super_admin'" : "";

    const { rows } = await query<any>(`
      SELECT r.id, r.name, r.display_name, r.description, r.is_system,
             COALESCE(r.is_active, TRUE) AS is_active,
             r.created_at, r.updated_at,
             COUNT(DISTINCT ur.user_id)::int AS user_count,
             COUNT(DISTINCT rp.permission_id)::int AS permission_count
        FROM roles r
   LEFT JOIN user_roles ur ON ur.role_id = r.id
   LEFT JOIN role_permissions rp ON rp.role_id = r.id
   ${filterClause}
    GROUP BY r.id
    ORDER BY
      CASE
        WHEN r.name = 'super_admin' THEN 1
        WHEN r.name = 'isp_admin' THEN 2
        WHEN r.name = 'branch_manager' THEN 3
        ELSE 4
      END,
      r.is_system DESC, r.name ASC
    `);

    return rows.map((r) => {
      const isDevOnly = r.name === 'super_admin';
      return {
        ...r,
        is_developer_only: isDevOnly,
        can_edit: !isDevOnly && (r.is_system ? isDev : true),
        created_at: new Date(r.created_at).toISOString(),
        updated_at: new Date(r.updated_at).toISOString(),
      };
    });
  },

  /** Get role details with full permission list and assigned users */
  async getRoleById(roleId: number, actor?: AuthSession): Promise<RoleItem & { permissions: string[] }> {
    const { rows } = await query<any>('SELECT *, COALESCE(is_active, TRUE) as is_active FROM roles WHERE id = $1', [roleId]);
    if (!rows[0]) throw HttpError.notFound('Role not found');
    const r = rows[0];

    // If caller is not developer super admin, Super Admin role does not exist to them
    if (r.name === 'super_admin' && !isSuperAdmin(actor)) {
      throw HttpError.notFound('Role not found');
    }

    const permRes = await query<{ key: string }>(
      `SELECT p.key FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = $1
        ORDER BY p.key`,
      [roleId]
    );

    // Fetch users assigned to this role (excluding super_admin users for non-super_admins)
    const userConditions = ['ur.role_id = $1'];
    if (!isSuperAdmin(actor)) {
      userConditions.push(`NOT EXISTS (
        SELECT 1 FROM user_roles ur_sa
        JOIN roles r_sa ON r_sa.id = ur_sa.role_id
        WHERE ur_sa.user_id = u.id AND r_sa.name = 'super_admin'
      )`);
    }

    const usersRes = await query<{ id: string; username: string; full_name: string | null; email: string | null; status: string }>(
      `SELECT u.id, u.username, u.full_name, u.email, COALESCE(u.status, 'ACTIVE') AS status
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
        WHERE ${userConditions.join(' AND ')}
        ORDER BY u.username ASC
        LIMIT 100`,
      [roleId]
    );

    const isDevOnly = r.name === 'super_admin';

    return {
      id: r.id,
      name: r.name,
      display_name: r.display_name,
      description: r.description,
      is_system: r.is_system,
      is_active: r.is_active,
      is_developer_only: isDevOnly,
      can_edit: !isDevOnly || isSuperAdmin(actor),
      permissions: permRes.rows.map((p) => p.key),
      users: usersRes.rows,
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    };
  },

  /** Create custom role with permission boundary checks */
  async createRole(
    input: {
      name: string;
      displayName: string;
      description?: string;
      permissionKeys: string[];
      isActive?: boolean;
      actorId?: string;
    },
    actor?: AuthSession
  ): Promise<number> {
    const sanitizedName = input.name.trim().toLowerCase().replace(/\s+/g, '_');
    if (sanitizedName === 'super_admin' || sanitizedName === 'isp_admin' || sanitizedName === 'branch_manager') {
      throw HttpError.badRequest('Reserved role name');
    }

    const existing = await query('SELECT id FROM roles WHERE name = $1', [sanitizedName]);
    if (existing.rows.length > 0) {
      throw HttpError.badRequest(`Role with name "${sanitizedName}" already exists`);
    }

    assertCanGrantPermissions(actor, input.permissionKeys || []);

    // Validate that every requested permission exists in permissions table
    if (input.permissionKeys && input.permissionKeys.length > 0) {
      const validPerms = await query<{ key: string }>(
        'SELECT key FROM permissions WHERE key = ANY($1::text[])',
        [input.permissionKeys]
      );
      const validSet = new Set(validPerms.rows.map((p) => p.key));
      const invalidKeys = input.permissionKeys.filter((k) => !validSet.has(k));
      if (invalidKeys.length > 0) {
        throw HttpError.badRequest(`Invalid permission key(s): ${invalidKeys.join(', ')}`);
      }
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const roleRes = await client.query<{ id: number }>(
        `INSERT INTO roles (name, display_name, description, is_system, is_active)
         VALUES ($1, $2, $3, FALSE, $4) RETURNING id`,
        [
          sanitizedName,
          input.displayName.trim(),
          input.description?.trim() || null,
          input.isActive !== undefined ? input.isActive : true,
        ]
      );
      const roleId = roleRes.rows[0].id;

      if (input.permissionKeys && input.permissionKeys.length > 0) {
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           SELECT $1, p.id FROM permissions p
            WHERE p.key = ANY($2::text[])
           ON CONFLICT DO NOTHING`,
          [roleId, input.permissionKeys]
        );
      }

      await client.query('COMMIT');

      await auditRepository.insert({
        userId: input.actorId,
        action: 'role.created',
        entityType: 'role',
        entityId: String(roleId),
        status: 'success',
        metadata: { roleName: sanitizedName, permissions: input.permissionKeys },
      });

      return roleId;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /** Duplicate an existing role copying its permissions to a new custom role */
  async duplicateRole(
    sourceRoleId: number,
    input: {
      name?: string;
      displayName: string;
      description?: string;
    },
    actor?: AuthSession
  ): Promise<number> {
    const source = await this.getRoleById(sourceRoleId, actor);

    let newName = input.name ? input.name.trim().toLowerCase().replace(/\s+/g, '_') : `${source.name}_copy_${Date.now()}`;
    const roleId = await this.createRole(
      {
        name: newName,
        displayName: input.displayName.trim() || `${source.display_name} (Copy)`,
        description: input.description || `Cloned from ${source.display_name}`,
        permissionKeys: source.permissions || [],
        actorId: actor?.userId,
      },
      actor
    );

    return roleId;
  },

  /** Toggle role active/inactive status */
  async toggleRoleStatus(roleId: number, isActive: boolean, actor?: AuthSession): Promise<void> {
    const role = await this.getRoleById(roleId, actor);
    if (role.name === 'super_admin' || role.name === 'isp_admin' || role.name === 'branch_manager' || role.name === 'organization_admin') {
      throw HttpError.forbidden('Core system roles cannot be disabled');
    }

    await query('UPDATE roles SET is_active = $2, updated_at = NOW() WHERE id = $1', [roleId, isActive]);

    await auditRepository.insert({
      userId: actor?.userId,
      action: `role.${isActive ? 'enabled' : 'disabled'}`,
      entityType: 'role',
      entityId: String(roleId),
      status: 'success',
      metadata: { roleName: role.name, isActive },
    });
  },

  /** Update role permissions and descriptions */
  async updateRole(
    roleId: number,
    input: {
      displayName?: string;
      description?: string;
      permissionKeys?: string[];
      isActive?: boolean;
      actorId?: string;
    },
    actor?: AuthSession
  ): Promise<void> {
    const roleRes = await query<{ is_system: boolean; name: string }>('SELECT is_system, name FROM roles WHERE id = $1', [roleId]);
    if (!roleRes.rows[0]) throw HttpError.notFound('Role not found');

    const roleName = roleRes.rows[0].name;
    if (roleName === 'super_admin' && !isSuperAdmin(actor)) {
      throw HttpError.notFound('Role not found');
    }

    if (input.permissionKeys !== undefined) {
      assertCanGrantPermissions(actor, input.permissionKeys);

      if (input.permissionKeys.length > 0) {
        const validPerms = await query<{ key: string }>(
          'SELECT key FROM permissions WHERE key = ANY($1::text[])',
          [input.permissionKeys]
        );
        const validSet = new Set(validPerms.rows.map((p) => p.key));
        const invalidKeys = input.permissionKeys.filter((k) => !validSet.has(k));
        if (invalidKeys.length > 0) {
          throw HttpError.badRequest(`Invalid permission key(s): ${invalidKeys.join(', ')}`);
        }
      }
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE roles
            SET display_name = COALESCE($2, display_name),
                description = COALESCE($3, description),
                is_active = COALESCE($4, is_active),
                updated_at = NOW()
          WHERE id = $1`,
        [
          roleId,
          input.displayName?.trim() || null,
          input.description?.trim() || null,
          input.isActive !== undefined ? input.isActive : null,
        ]
      );

      if (input.permissionKeys !== undefined) {
        await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
        if (input.permissionKeys.length > 0) {
          await client.query(
            `INSERT INTO role_permissions (role_id, permission_id)
             SELECT $1, p.id FROM permissions p
              WHERE p.key = ANY($2::text[])
             ON CONFLICT DO NOTHING`,
            [roleId, input.permissionKeys]
          );
        }

        // Invalidate sessions for all users holding this role
        await client.query(
          `UPDATE users u
              SET token_version = token_version + 1,
                  updated_at = NOW()
            WHERE EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id = $1)`,
          [roleId]
        );
        await client.query(
          `UPDATE login_sessions ls
              SET is_revoked = TRUE
            WHERE EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = ls.user_id AND ur.role_id = $1)`,
          [roleId]
        );
      }

      await client.query('COMMIT');

      await auditRepository.insert({
        userId: input.actorId,
        action: 'role.updated',
        entityType: 'role',
        entityId: String(roleId),
        status: 'success',
        metadata: { permissionsUpdated: input.permissionKeys !== undefined },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /** Delete custom role */
  async deleteRole(roleId: number, actorId?: string, actor?: AuthSession): Promise<void> {
    const roleRes = await query<{ is_system: boolean; name: string }>('SELECT is_system, name FROM roles WHERE id = $1', [roleId]);
    if (!roleRes.rows[0]) throw HttpError.notFound('Role not found');
    if (roleRes.rows[0].name === 'super_admin' && !isSuperAdmin(actor)) {
      throw HttpError.notFound('Role not found');
    }
    if (roleRes.rows[0].is_system) {
      throw HttpError.forbidden('System roles cannot be deleted');
    }

    const countRes = await query<{ count: string }>('SELECT COUNT(*)::text as count FROM user_roles WHERE role_id = $1', [roleId]);
    if (parseInt(countRes.rows[0]?.count || '0', 10) > 0) {
      throw HttpError.badRequest('Cannot delete role: active staff users are still assigned to this role');
    }

    await query('DELETE FROM roles WHERE id = $1', [roleId]);

    await auditRepository.insert({
      userId: actorId,
      action: 'role.deleted',
      entityType: 'role',
      entityId: String(roleId),
      status: 'success',
    });
  },

  /** List all permissions catalog grouped by module (developer permissions hidden for non-super_admins) */
  async listPermissions(actor?: AuthSession): Promise<Record<string, PermissionItem[]>> {
    const { rows } = await query<PermissionItem>(
      'SELECT id, key, module, description FROM permissions ORDER BY module ASC, key ASC'
    );

    const isDev = isSuperAdmin(actor);
    const grouped: Record<string, PermissionItem[]> = {};

    for (const p of rows) {
      if (!isDev && isDeveloperOnlyPermission(p.key)) {
        continue;
      }
      const mod = p.module.toUpperCase();
      if (!grouped[mod]) grouped[mod] = [];
      grouped[mod].push(p);
    }
    return grouped;
  },
};
