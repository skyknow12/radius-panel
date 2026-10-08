import bcrypt from 'bcryptjs';
import { query, getClient } from '../db/pool';
import { HttpError } from '../lib/http-error';
import { auditRepository } from './audit.repository';

export interface UserManagementItem {
  id: string;
  username: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  is_active: boolean;
  data_scope: 'GLOBAL' | 'ORGANIZATION' | 'BRANCH' | 'RESELLER' | 'OWN';
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
  created_at: string;
  updated_at: string;
}

export interface RoleItem {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  is_system: boolean;
  user_count?: number;
  permission_count?: number;
  permissions?: string[];
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
  ip_address: string | null;
  user_agent: string | null;
  last_activity: string;
  expires_at: string | null;
  is_revoked: boolean;
  created_at: string;
}

export const userManagementRepository = {
  /** List all staff users with filters, search, and pagination */
  async listUsers(params: {
    search?: string;
    role?: string;
    status?: string;
    data_scope?: string;
    organization_id?: number;
    branch_id?: number;
    reseller_id?: number;
    page?: number;
    limit?: number;
  }): Promise<{ users: UserManagementItem[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const values: any[] = [];
    let idx = 1;

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

    if (params.organization_id) {
      conditions.push(`u.organization_id = $${idx}`);
      values.push(params.organization_id);
      idx++;
    }

    if (params.branch_id) {
      conditions.push(`u.branch_id = $${idx}`);
      values.push(params.branch_id);
      idx++;
    }

    if (params.reseller_id) {
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

    const dataQuery = `
      SELECT u.id, u.username, u.email, u.full_name, u.phone,
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
    ORDER BY u.created_at DESC
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
  async getUserById(id: string): Promise<UserManagementItem & { permissions: string[] }> {
    const dataQuery = `
      SELECT u.id, u.username, u.email, u.full_name, u.phone,
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

  /** Create a new staff user with multi-role assignments */
  async createUser(input: {
    username: string;
    email?: string;
    fullName: string;
    phone?: string;
    password: string;
    roleIds: number[];
    dataScope?: 'GLOBAL' | 'ORGANIZATION' | 'BRANCH' | 'RESELLER' | 'OWN';
    userType?: 'isp' | 'branch' | 'reseller';
    organizationId?: number;
    branchId?: number;
    resellerId?: number;
    forcePasswordReset?: boolean;
    createdBy?: string;
  }): Promise<string> {
    const existing = await query('SELECT id FROM users WHERE lower(username) = lower($1) OR (email IS NOT NULL AND lower(email) = lower($2))', [
      input.username,
      input.email || '',
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

    const passwordHash = await bcrypt.hash(input.password, 10);
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Primary role for backwards compatibility with users.role_id
      const primaryRoleId = input.roleIds[0];

      const userRes = await client.query<{ id: string }>(
        `INSERT INTO users (
           username, email, full_name, phone, password_hash,
           role_id, status, is_active, data_scope, user_type,
           organization_id, branch_id, reseller_id,
           force_password_reset, created_by, updated_by
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, 'ACTIVE', TRUE, $7, $8,
           $9, $10, $11,
           $12, $13, $13
         ) RETURNING id`,
        [
          input.username.trim(),
          input.email?.trim() || null,
          input.fullName.trim(),
          input.phone?.trim() || null,
          passwordHash,
          primaryRoleId,
          input.dataScope || 'OWN',
          input.userType || 'isp',
          input.organizationId || null,
          input.branchId || null,
          input.resellerId || null,
          !!input.forcePasswordReset,
          input.createdBy || null,
        ]
      );

      const userId = userRes.rows[0].id;

      // Assign roles into user_roles
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
          dataScope: input.dataScope,
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

  /** Update staff user account */
  async updateUser(
    id: string,
    input: {
      fullName?: string;
      email?: string;
      phone?: string;
      status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
      roleIds?: number[];
      dataScope?: 'GLOBAL' | 'ORGANIZATION' | 'BRANCH' | 'RESELLER' | 'OWN';
      organizationId?: number | null;
      branchId?: number | null;
      resellerId?: number | null;
      userType?: 'isp' | 'branch' | 'reseller';
      forcePasswordReset?: boolean;
      updatedBy?: string;
    }
  ): Promise<void> {
    const existing = await query<{ id: string; username: string }>('SELECT id, username FROM users WHERE id = $1', [id]);
    if (!existing.rows[0]) {
      throw HttpError.notFound('User not found');
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
                updated_by = $13,
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
        // Update primary role in users table
        await client.query('UPDATE users SET role_id = $2 WHERE id = $1', [id, input.roleIds[0]]);
      }

      await client.query('COMMIT');

      await auditRepository.insert({
        userId: input.updatedBy,
        action: 'user.updated',
        entityType: 'user',
        entityId: id,
        status: 'success',
        metadata: { updatedFields: Object.keys(input) },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /** Reset user password */
  async resetPassword(id: string, newPass: string, forceNextReset = false, changedBy?: string): Promise<void> {
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
      metadata: { forceNextReset },
    });
  },

  /** Force logout: terminates active sessions and bumps token version */
  async forceLogout(id: string, actorId?: string): Promise<void> {
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
  async setStatus(id: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED', actorId?: string): Promise<void> {
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
      await this.forceLogout(id, actorId);
    }

    await auditRepository.insert({
      userId: actorId,
      action: `user.status_${status.toLowerCase()}`,
      entityType: 'user',
      entityId: id,
      status: 'success',
    });
  },

  /** List user login history */
  async getLoginHistory(userId: string, limit = 50): Promise<LoginHistoryItem[]> {
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

  /** List active login sessions */
  async getSessions(userId: string): Promise<UserSessionItem[]> {
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

  // ---------------------------------------------------------------------------
  //  ROLES & PERMISSIONS
  // ---------------------------------------------------------------------------

  /** List all roles with member counts and permission count */
  async listRoles(): Promise<RoleItem[]> {
    const { rows } = await query<any>(`
      SELECT r.id, r.name, r.display_name, r.description, r.is_system,
             r.created_at, r.updated_at,
             COUNT(DISTINCT ur.user_id)::int AS user_count,
             COUNT(DISTINCT rp.permission_id)::int AS permission_count
        FROM roles r
   LEFT JOIN user_roles ur ON ur.role_id = r.id
   LEFT JOIN role_permissions rp ON rp.role_id = r.id
    GROUP BY r.id
    ORDER BY r.is_system DESC, r.name ASC
    `);

    return rows.map((r) => ({
      ...r,
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    }));
  },

  /** Get role details with full permission list */
  async getRoleById(roleId: number): Promise<RoleItem & { permissions: string[] }> {
    const { rows } = await query<any>('SELECT * FROM roles WHERE id = $1', [roleId]);
    if (!rows[0]) throw HttpError.notFound('Role not found');
    const r = rows[0];

    const permRes = await query<{ key: string }>(
      `SELECT p.key FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = $1
        ORDER BY p.key`,
      [roleId]
    );

    return {
      id: r.id,
      name: r.name,
      display_name: r.display_name,
      description: r.description,
      is_system: r.is_system,
      permissions: permRes.rows.map((p) => p.key),
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    };
  },

  /** Create custom role */
  async createRole(input: {
    name: string;
    displayName: string;
    description?: string;
    permissionKeys: string[];
    actorId?: string;
  }): Promise<number> {
    const sanitizedName = input.name.trim().toLowerCase().replace(/\s+/g, '_');
    const existing = await query('SELECT id FROM roles WHERE name = $1', [sanitizedName]);
    if (existing.rows.length > 0) {
      throw HttpError.badRequest(`Role with name "${sanitizedName}" already exists`);
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const roleRes = await client.query<{ id: number }>(
        `INSERT INTO roles (name, display_name, description, is_system)
         VALUES ($1, $2, $3, FALSE) RETURNING id`,
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

  /** Update role permissions and descriptions */
  async updateRole(
    roleId: number,
    input: {
      displayName?: string;
      description?: string;
      permissionKeys?: string[];
      actorId?: string;
    }
  ): Promise<void> {
    const roleRes = await query<{ is_system: boolean; name: string }>('SELECT is_system, name FROM roles WHERE id = $1', [roleId]);
    if (!roleRes.rows[0]) throw HttpError.notFound('Role not found');

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
  async deleteRole(roleId: number, actorId?: string): Promise<void> {
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

  /** List all permissions catalog grouped by module */
  async listPermissions(): Promise<Record<string, PermissionItem[]>> {
    const { rows } = await query<PermissionItem>(
      'SELECT id, key, module, description FROM permissions ORDER BY module ASC, key ASC'
    );
    const grouped: Record<string, PermissionItem[]> = {};
    for (const p of rows) {
      if (!grouped[p.module]) grouped[p.module] = [];
      grouped[p.module].push(p);
    }
    return grouped;
  },
};
