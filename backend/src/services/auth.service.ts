import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { userRepository } from '../repositories/user.repository';
import { auditRepository } from '../repositories/audit.repository';
import { HttpError } from '../lib/http-error';
import { logger } from '../lib/logger';

import { query } from '../db/pool';

export interface AuthSession {
  userId: string;
  username: string;
  role: string;
  roles?: string[];
  permissions: string[];
  userType?: string;
  organizationId?: number | null;
  branchId?: number | null;
  resellerId?: number | null;
  dataScope?: string;
  tokenVersion?: number;
  forcePasswordReset?: boolean;
}

export const authService = {
  async ensureInitialAdmin(): Promise<void> {
    const existing = await userRepository.findByUsername(config.ADMIN_USERNAME);
    if (existing) {
      return;
    }
    const adminPassword = config.ADMIN_PASSWORD || 'Admin@12345';
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const userId = await userRepository.create({
      username: config.ADMIN_USERNAME,
      email: config.ADMIN_EMAIL,
      fullName: config.ADMIN_FULL_NAME,
      passwordHash,
      roleName: 'super_admin',
    });
    logger.info({ userId, username: config.ADMIN_USERNAME }, 'Initial administrator account created');
    await auditRepository.insert({
      userId,
      username: config.ADMIN_USERNAME,
      action: 'system.bootstrap_admin',
      entityType: 'user',
      entityId: userId,
      status: 'success',
      metadata: { note: 'Initial bootstrap admin generated' },
    });
  },

  async authenticate(username: string, password: string, ip: string | null, userAgent: string | null) {
    const user = await userRepository.findByUsername(username);
    if (!user) {
      await query(
        `INSERT INTO login_history (username, ip_address, user_agent, status, failure_reason)
         VALUES ($1, $2, $3, 'FAILED', 'user_not_found')`,
        [username, ip, userAgent]
      ).catch(() => undefined);

      await auditRepository.insert({
        username,
        action: 'auth.login_failed',
        entityType: 'user',
        status: 'failure',
        ipAddress: ip,
        userAgent,
        metadata: { reason: 'user_not_found' },
      });
      throw HttpError.unauthorized('Invalid username or password');
    }

    if (!user.is_active || user.status === 'INACTIVE' || user.status === 'SUSPENDED') {
      await query(
        `INSERT INTO login_history (user_id, username, ip_address, user_agent, status, failure_reason)
         VALUES ($1, $2, $3, $4, 'FAILED', 'account_disabled')`,
        [user.id, user.username, ip, userAgent]
      ).catch(() => undefined);

      throw HttpError.forbidden(`Account is ${user.status === 'SUSPENDED' ? 'suspended' : 'disabled'}`);
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      await query(
        `INSERT INTO login_history (user_id, username, ip_address, user_agent, status, failure_reason)
         VALUES ($1, $2, $3, $4, 'LOCKED', 'account_temporarily_locked')`,
        [user.id, user.username, ip, userAgent]
      ).catch(() => undefined);

      throw HttpError.forbidden('Account is temporarily locked due to failed attempts');
    }

    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) {
      await userRepository.recordFailedLogin(user.id, 5, 15);
      await query(
        `INSERT INTO login_history (user_id, username, ip_address, user_agent, status, failure_reason)
         VALUES ($1, $2, $3, $4, 'FAILED', 'invalid_password')`,
        [user.id, user.username, ip, userAgent]
      ).catch(() => undefined);

      await auditRepository.insert({
        userId: user.id,
        username: user.username,
        action: 'auth.login_failed',
        entityType: 'user',
        entityId: user.id,
        status: 'failure',
        ipAddress: ip,
        userAgent,
        metadata: { reason: 'invalid_password' },
      });
      throw HttpError.unauthorized('Invalid username or password');
    }

    await userRepository.recordSuccessfulLogin(user.id, ip);

    // Record in login_history
    await query(
      `INSERT INTO login_history (user_id, username, ip_address, user_agent, status)
       VALUES ($1, $2, $3, $4, 'SUCCESS')`,
      [user.id, user.username, ip, userAgent]
    ).catch(() => undefined);

    // Create session entry
    await query(
      `INSERT INTO login_sessions (user_id, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, NOW() + interval '24 hours')`,
      [user.id, ip, userAgent]
    ).catch(() => undefined);

    // Unified permissions and multiple roles
    const permissions = await userRepository.permissionsForUser(user.id, user.role_id);
    const assignedRoles = await userRepository.rolesForUser(user.id, user.role_name);

    const payload: AuthSession = {
      userId: user.id,
      username: user.username,
      role: user.role_name,
      roles: assignedRoles,
      permissions,
      userType: user.user_type,
      organizationId: user.organization_id,
      branchId: user.branch_id,
      resellerId: user.reseller_id,
      dataScope: user.data_scope || 'OWN',
      tokenVersion: user.token_version || 1,
      forcePasswordReset: !!user.force_password_reset,
    };

    const token = jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN as any,
    });

    await auditRepository.insert({
      userId: user.id,
      username: user.username,
      action: 'auth.login_success',
      entityType: 'user',
      entityId: user.id,
      status: 'success',
      ipAddress: ip,
      userAgent,
    });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone || null,
        role: user.role_name,
        roles: assignedRoles,
        roleDisplay: user.role_display_name,
        permissions,
        userType: user.user_type || 'isp',
        dataScope: user.data_scope || 'OWN',
        organizationId: user.organization_id || null,
        branchId: user.branch_id || null,
        resellerId: user.reseller_id || null,
        forcePasswordReset: !!user.force_password_reset,
      },
    };
  },

  verifyToken(token: string): AuthSession {
    try {
      return jwt.verify(token, config.JWT_SECRET) as AuthSession;
    } catch {
      throw HttpError.unauthorized('Invalid or expired token');
    }
  },
};
