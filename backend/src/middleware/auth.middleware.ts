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
    if (req.user.role === 'super_admin' || req.user.permissions.includes(permissionKey)) {
      return next();
    }
    return next(HttpError.forbidden(`Missing required permission: ${permissionKey}`));
  };
}
