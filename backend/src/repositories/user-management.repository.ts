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
  DEVELOPER_ONLY_PERMISSIONS,
} from '../lib/access-control';
import type { AuthSession } from '../services/auth.service';

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
  ): Promise<{ users: UserManagementItem[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const values: any[] = [];
    let idx = 1;

    // Scope Restriction: Non-super_admin CANNOT view Developer Super Admin users
    if (!isSuperAdmin(actor)) {
      conditions.push(`NOT EXISTS (
        SELECT 1 FROM user_roles ur_sa
        JOIN roles r_sa ON r_sa.id = ur_sa.role_id
        WHERE ur_sa.user_id = u.id AND r_sa.name = 'super_admin'
      )`);
      conditions.push(`u.role_id NOT IN (SELECT id FROM roles WHERE name = 'super_admin')`);

      // Branch users can only view their own branch
      if (isBranchUser(actor)) {
        conditions.push(`u.branch_id = $${idx}`);
        values.push(actor?.branchId || -1);
        idx++;
      } else if (isResellerUser(actor)) {
        // Reseller users can only view their own reseller
        conditions.push(`u.reseller_id = $${idx}`);
        values.push(actor?.resellerId || -1);
        idx++;
      } else if (actor?.organizationId) {
        // ISP Admin scoped to own organization
        conditions.push(`(u.organization_id = $${idx} OR u.organization_id IS NULL)`);
        values.push(actor.organizationId);
        idx++;
      }
    }

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
      conditions.push(`EXISTS (
        SELECT 1 FROM user_roles ur2
        JOIN roles r2 ON r2.id = ur2.role_id
        WHERE ur2.user_id = u.id AND (r2.name = $${idx} OR r2.id::text = $${idx})
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
             res.business_name AS reseller_name,
             u.last_login_at, u.last_login_ip,
             u.force_password_reset,
             COALESCE(u.token_version, 1) AS token_version,
             u.created_at, u.updated_at,
             COALESCE(
               json_agg(
                 json_build_object('id', r.id, 'name', r.name, 'display_name', r.display_name)
               ) FILTER (WHERE r.id IS NOT NULL),
               '[]'::json
             ) AS roles
        FROM users u
   LEFT JOIN organizations org ON org.id = u.organization_id
   LEFT JOIN branches b ON b.id = u.branch_id
   LEFT JOIN resellers res ON res.id = u.reseller_id
   LEFT JOIN user_roles ur ON ur.user_id = u.id
   LEFT JOIN roles r ON r.id = ur.role_id
       WHERE ${whereClause}
    GROUP BY u.id, org.name, b.name, res.business_name
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
             res.business_name AS reseller_name,
             u.last_login_at, u.last_login_ip,
             u.force_password_reset,
             COALESCE(u.token_version, 1) AS token_version,
             u.created_at, u.updated_at,
             COALESCE(
               json_agg(
                 DISTINCT jsonb_build_object('id', r.id, 'name', r.name, 'display_name', r.display_name)
               ) FILTER (WHERE r.id IS NOT NULL),
               '[]'::json
             ) AS roles
        FROM users u
   LEFT JOIN organizations org ON org.id = u.organization_id
   LEFT JOIN branches b ON b.id = u.branch_id
   LEFT JOIN resellers res ON res.id = u.reseller_id
   LEFT JOIN user_roles ur ON ur.user_id = u.id
   LEFT JOIN roles r ON r.id = ur.role_id
       WHERE u.id = $1
    GROUP BY u.id, org.name, b.name, res.business_name
    `;

    const { rows } = await query<any>(dataQuery, [id]);
    if (!rows[0]) {
      throw HttpError.notFound('User not found');
    }

    const r = rows[0];
    const parsedRoles = Array.isArray(r.roles) ? r.roles : [];

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
         FROM user_roles ur
         JOIN role_permissions rp ON rp.role_id = ur.role_id
         JOIN permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = $1
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
    const existing = await query('SELECT id FROM users WHERE lower(username) = lower($1) OR (email IS NOT NULL AND lower(email) = lower($2))', [
      input.username.trim(),
      input.email?.trim() || '',
    ]);
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
    } else if (isResellerUser(actor)) {
      resellerId = actor?.resellerId || undefined;
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
    // 1. Ensure the 3 default roles exist with stable internal identifiers
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

    // 2. Grant all permissions to super_admin
    await query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
        FROM roles r, permissions p
       WHERE r.name = 'super_admin'
      ON CONFLICT DO NOTHING
    `);

    // 3. Grant operational permissions to isp_admin (excluding developer-only)
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
      ON CONFLICT DO NOTHING
    `);

    // 4. Grant branch & reseller operational permissions to branch_manager
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
           'notifications.view'
         )
      ON CONFLICT DO NOTHING
    `);
  },

  /** List all roles with member counts, permission count, and developer flags */
  async listRoles(actor?: AuthSession): Promise<RoleItem[]> {
    const { rows } = await query<any>(`
      SELECT r.id, r.name, r.display_name, r.description, r.is_system,
             COALESCE(r.is_active, TRUE) AS is_active,
             r.created_at, r.updated_at,
             COUNT(DISTINCT ur.user_id)::int AS user_count,
             COUNT(DISTINCT rp.permission_id)::int AS permission_count
        FROM roles r
   LEFT JOIN user_roles ur ON ur.role_id = r.id
   LEFT JOIN role_permissions rp ON rp.role_id = r.id
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
        can_edit: !isDevOnly && (r.is_system ? isSuperAdmin(actor) : true),
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

    const permRes = await query<{ key: string }>(
      `SELECT p.key FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = $1
        ORDER BY p.key`,
      [roleId]
    );

    // Fetch users assigned to this role
    const usersRes = await query<{ id: string; username: string; full_name: string | null; email: string | null; status: string }>(
      `SELECT u.id, u.username, u.full_name, u.email, COALESCE(u.status, 'ACTIVE') AS status
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
        WHERE ur.role_id = $1
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
      actorId?: string;
    },
    actor?: AuthSession
  ): Promise<number> {
    const sanitizedName = input.name.trim().toLowerCase().replace(/\s+/g, '_');
    if (sanitizedName === 'super_admin' || sanitizedName === 'isp_admin') {
      throw HttpError.badRequest('Reserved role name');
    }

    const existing = await query('SELECT id FROM roles WHERE name = $1', [sanitizedName]);
    if (existing.rows.length > 0) {
      throw HttpError.badRequest(`Role with name "${sanitizedName}" already exists`);
    }

    assertCanGrantPermissions(actor, input.permissionKeys || []);

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const roleRes = await client.query<{ id: number }>(
        `INSERT INTO roles (name, display_name, description, is_system, is_active)
         VALUES ($1, $2, $3, FALSE, TRUE) RETURNING id`,
        [sanitizedName, input.displayName.trim(), input.description?.trim() || null]
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
    if (role.name === 'super_admin' || role.name === 'isp_admin' || role.name === 'organization_admin') {
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
      actorId?: string;
    },
    actor?: AuthSession
  ): Promise<void> {
    const roleRes = await query<{ is_system: boolean; name: string }>('SELECT is_system, name FROM roles WHERE id = $1', [roleId]);
    if (!roleRes.rows[0]) throw HttpError.notFound('Role not found');

    const roleName = roleRes.rows[0].name;
    if (roleName === 'super_admin' && !isSuperAdmin(actor)) {
      throw HttpError.forbidden('Only Developer Super Admin can modify the Super Admin role');
    }

    if (input.permissionKeys !== undefined) {
      assertCanGrantPermissions(actor, input.permissionKeys);
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE roles
            SET display_name = COALESCE($2, display_name),
                description = COALESCE($3, description),
                updated_at = NOW()
          WHERE id = $1`,
        [roleId, input.displayName?.trim() || null, input.description?.trim() || null]
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
  async deleteRole(roleId: number, actorId?: string, _actor?: AuthSession): Promise<void> {
    const roleRes = await query<{ is_system: boolean; name: string }>('SELECT is_system, name FROM roles WHERE id = $1', [roleId]);
    if (!roleRes.rows[0]) throw HttpError.notFound('Role not found');
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
      if (!isDev && DEVELOPER_ONLY_PERMISSIONS.includes(p.key)) {
        continue;
      }
      if (!grouped[p.module]) grouped[p.module] = [];
      grouped[p.module].push(p);
    }
    return grouped;
  },
};
