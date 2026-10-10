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

export function requirePermission(permissionKey: string) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(HttpError.unauthorized());
    }
    // Developer Super Admin has all permissions
    if (req.user.role === 'super_admin' || (req.user.roles && req.user.roles.includes('super_admin'))) {
      return next();
    }
    if (req.user.permissions && req.user.permissions.includes(permissionKey)) {
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

