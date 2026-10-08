import { query } from '../db/pool';

export interface UserRow {
  id: string;
  username: string;
  email: string | null;
  full_name: string | null;
  password_hash: string;
  is_active: boolean;
  failed_login_attempts: number;
  locked_until: Date | null;
  last_login_at: Date | null;
  role_id: number;
  role_name: string;
  role_display_name: string;
  organization_id?: number | null;
  branch_id?: number | null;
  reseller_id?: number | null;
  employee_id?: string | null;
  user_type?: string;
  phone?: string | null;
  status?: string;
  data_scope?: string;
  force_password_reset?: boolean;
  token_version?: number;
}

const SELECT_USER = `
  SELECT u.id, u.username, u.email, u.full_name, u.password_hash, u.is_active,
         u.failed_login_attempts, u.locked_until, u.last_login_at,
         u.organization_id, u.branch_id, u.reseller_id, u.employee_id,
         u.phone,
         COALESCE(u.status, 'ACTIVE') AS status,
         COALESCE(u.data_scope, 'OWN') AS data_scope,
         COALESCE(u.force_password_reset, FALSE) AS force_password_reset,
         COALESCE(u.token_version, 1) AS token_version,
         COALESCE(u.user_type, 'isp') AS user_type,
         r.id AS role_id, r.name AS role_name, r.display_name AS role_display_name
    FROM users u
    JOIN roles r ON r.id = u.role_id`;

export const userRepository = {
  async findByUsername(username: string): Promise<UserRow | null> {
    const { rows } = await query<UserRow>(
      `${SELECT_USER} WHERE lower(u.username) = lower($1) OR lower(u.email) = lower($1)`,
      [username]
    );
    return rows[0] ?? null;
  },

  async findById(id: string): Promise<UserRow | null> {
    const { rows } = await query<UserRow>(`${SELECT_USER} WHERE u.id = $1`, [id]);
    return rows[0] ?? null;
  },

  async permissionsForRole(roleId: number): Promise<string[]> {
    const { rows } = await query<{ key: string }>(
      `SELECT p.key FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = $1 ORDER BY p.key`,
      [roleId],
    );
    return rows.map((r) => r.key);
  },

  async permissionsForUser(userId: string, primaryRoleId: number): Promise<string[]> {
    const { rows } = await query<{ key: string }>(
      `SELECT DISTINCT p.key
         FROM permissions p
         JOIN role_permissions rp ON rp.permission_id = p.id
        WHERE rp.role_id IN (
          SELECT role_id FROM user_roles WHERE user_id = $1
          UNION
          SELECT $2
        )
        ORDER BY p.key`,
      [userId, primaryRoleId]
    );
    return rows.map((r) => r.key);
  },

  async rolesForUser(userId: string, primaryRoleName: string): Promise<string[]> {
    const { rows } = await query<{ name: string }>(
      `SELECT DISTINCT r.name
         FROM roles r
         JOIN user_roles ur ON ur.role_id = r.id
        WHERE ur.user_id = $1`,
      [userId]
    );
    const names = rows.map((r) => r.name);
    if (!names.includes(primaryRoleName)) names.unshift(primaryRoleName);
    return names;
  },

  async create(input: {
    username: string;
    email: string | null;
    fullName: string | null;
    passwordHash: string;
    roleName: string;
  }): Promise<string> {
    const { rows } = await query<{ id: string }>(
      `INSERT INTO users (username, email, full_name, password_hash, role_id)
       VALUES ($1, $2, $3, $4, (SELECT id FROM roles WHERE name = $5))
       RETURNING id`,
      [input.username, input.email, input.fullName, input.passwordHash, input.roleName],
    );
    return rows[0].id;
  },

  async recordSuccessfulLogin(id: string, ip: string | null): Promise<void> {
    await query(
      `UPDATE users SET last_login_at = now(), last_login_ip = $2,
              failed_login_attempts = 0, locked_until = NULL
        WHERE id = $1`,
      [id, ip],
    );
  },

  async recordFailedLogin(id: string, maxAttempts: number, lockMinutes: number): Promise<void> {
    await query(
      `UPDATE users
          SET failed_login_attempts = failed_login_attempts + 1,
              locked_until = CASE WHEN failed_login_attempts + 1 >= $2
                                  THEN now() + make_interval(mins => $3) ELSE locked_until END
        WHERE id = $1`,
      [id, maxAttempts, lockMinutes],
    );
  },
};
