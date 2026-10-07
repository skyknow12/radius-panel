import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { userRepository } from '../repositories/user.repository';
import { auditRepository } from '../repositories/audit.repository';
import { HttpError } from '../lib/http-error';
import { logger } from '../lib/logger';

export interface AuthSession {
  userId: string;
  username: string;
  role: string;
  permissions: string[];
  userType?: string;
  organizationId?: number | null;
  branchId?: number | null;
  resellerId?: number | null;
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

    if (!user.is_active) {
      throw HttpError.forbidden('Account is disabled');
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw HttpError.forbidden('Account is temporarily locked due to failed attempts');
    }

    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) {
      await userRepository.recordFailedLogin(user.id, 5, 15);
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
    const permissions = await userRepository.permissionsForRole(user.role_id);

    const payload: AuthSession = {
      userId: user.id,
      username: user.username,
      role: user.role_name,
      permissions,
      userType: user.user_type,
      organizationId: user.organization_id,
      branchId: user.branch_id,
      resellerId: user.reseller_id,
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
        role: user.role_name,
        roleDisplay: user.role_display_name,
        permissions,
        userType: user.user_type || 'isp',
        organizationId: user.organization_id || null,
        branchId: user.branch_id || null,
        resellerId: user.reseller_id || null,
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
