import type { Request, Response, NextFunction } from 'express';
import { authService, type AuthSession } from '../services/auth.service';
import { HttpError } from '../lib/http-error';

export interface AuthenticatedRequest extends Request {
  user?: AuthSession;
}

export function authMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  // Check Authorization header or cookie
  const authHeader = req.headers.authorization;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.radius_token) {
    token = req.cookies.radius_token;
  }

  if (!token) {
    return next(HttpError.unauthorized('Missing authentication token'));
  }

  try {
    const payload = authService.verifyToken(token);
    req.user = payload;
    next();
  } catch (err) {
    next(err);
  }
}

const PERMISSION_ALIASES: Record<string, string[]> = {
  'subscriber.view': ['customers.view'],
  'customers.view': ['subscriber.view'],
  'subscriber.create': ['customers.create'],
  'customers.create': ['subscriber.create'],
  'subscriber.edit': ['customers.edit'],
  'customers.edit': ['subscriber.edit'],
  'subscriber.activate': ['customers.activate'],
  'customers.activate': ['subscriber.activate'],
  'subscriber.suspend': ['customers.suspend'],
  'customers.suspend': ['subscriber.suspend'],
  'subscriber.resume': ['customers.resume'],
  'customers.resume': ['subscriber.resume'],
  'subscriber.terminate': ['customers.terminate', 'customers.delete'],
  'customers.terminate': ['subscriber.terminate'],
  'subscriber.recharge': ['customers.recharge', 'billing.recharge'],
  'customers.recharge': ['subscriber.recharge', 'billing.recharge'],
  'subscriber.change_package': ['customers.change_package'],
  'customers.change_package': ['subscriber.change_package'],
  'package.view': ['packages.view'],
  'packages.view': ['package.view'],
  'package.create': ['packages.create'],
  'packages.create': ['package.create'],
  'package.edit': ['packages.edit'],
  'packages.edit': ['package.edit'],
  'package.delete': ['packages.delete'],
  'packages.delete': ['package.delete'],
  'branch.view': ['branches.view'],
  'branches.view': ['branch.view'],
  'branch.create': ['branches.create'],
  'branches.create': ['branch.create'],
  'branch.edit': ['branches.edit'],
  'branches.edit': ['branch.edit'],
  'branch.delete': ['branches.delete'],
  'branches.delete': ['branch.delete'],
  'reseller.view': ['resellers.view'],
  'resellers.view': ['reseller.view'],
  'reseller.create': ['resellers.create'],
  'resellers.create': ['reseller.create'],
  'reseller.edit': ['resellers.edit'],
  'resellers.edit': ['reseller.edit'],
  'reseller.delete': ['resellers.delete'],
  'resellers.delete': ['reseller.delete'],
};

export function requirePermission(permissionKey: string) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(HttpError.unauthorized());
    }
    // Developer Super Admin has all permissions
    if (req.user.role === 'super_admin' || (req.user.roles && req.user.roles.includes('super_admin'))) {
      return next();
    }
    const userPerms = req.user.permissions || [];
    if (userPerms.includes('*') || userPerms.includes(permissionKey)) {
      return next();
    }
    const aliases = PERMISSION_ALIASES[permissionKey] || [];
    if (aliases.some((alias) => userPerms.includes(alias))) {
      return next();
    }
    return next(HttpError.forbidden(`Missing required permission: ${permissionKey}`));
  };
}

export function requireDeveloperSuperAdmin() {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(HttpError.unauthorized());
    }
    if (req.user.role === 'super_admin' || (req.user.roles && req.user.roles.includes('super_admin'))) {
      return next();
    }
    return next(HttpError.forbidden('Access restricted to Developer Super Admin'));
  };
}

export function requireIspAdmin() {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(HttpError.unauthorized());
    }
    const isSuper = req.user.role === 'super_admin' || (req.user.roles && req.user.roles.includes('super_admin'));
    const isIsp =
      req.user.role === 'isp_admin' ||
      req.user.role === 'organization_admin' ||
      req.user.role === 'admin' ||
      (req.user.roles && (req.user.roles.includes('isp_admin') || req.user.roles.includes('organization_admin')));
    if (isSuper || isIsp) {
      return next();
    }
    return next(HttpError.forbidden('Access restricted to ISP Administrator'));
  };
}

