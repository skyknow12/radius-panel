import type { AuthSession } from '../services/auth.service';
import { HttpError } from './http-error';

export const DEVELOPER_ONLY_PERMISSIONS = [
  'system.developer_config',
  'system.diagnostics',
  'system.database_tools',
  'platform.organizations.manage',
];

export const DEVELOPER_ONLY_ROLES = ['super_admin'];

/** Check if session belongs to Developer Super Admin */
export function isSuperAdmin(user?: AuthSession): boolean {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  if (Array.isArray(user.roles) && user.roles.includes('super_admin')) return true;
  return false;
}

/** Check if session belongs to ISP Administrator / Owner */
export function isIspAdmin(user?: AuthSession): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (user.role === 'isp_admin' || user.role === 'organization_admin' || user.role === 'admin') return true;
  if (
    Array.isArray(user.roles) &&
    (user.roles.includes('isp_admin') || user.roles.includes('organization_admin') || user.roles.includes('admin'))
  ) {
    return true;
  }
  return false;
}

/** Check if session belongs to Branch scope */
export function isBranchUser(user?: AuthSession): boolean {
  if (!user) return false;
  return user.userType === 'branch' || user.dataScope === 'BRANCH' || (!!user.branchId && !isIspAdmin(user));
}

/** Check if session belongs to Reseller scope */
export function isResellerUser(user?: AuthSession): boolean {
  if (!user) return false;
  return user.userType === 'reseller' || user.dataScope === 'RESELLER' || (!!user.resellerId && !isIspAdmin(user));
}

/** Ensure caller can assign the given role */
export function assertCanAssignRole(actor: AuthSession | undefined, targetRoleName: string): void {
  if (DEVELOPER_ONLY_ROLES.includes(targetRoleName.toLowerCase())) {
    if (!isSuperAdmin(actor)) {
      throw HttpError.forbidden('Only Developer Super Admin can assign or grant the Super Admin role');
    }
  }
}

/** Ensure caller can grant the requested permissions */
export function assertCanGrantPermissions(actor: AuthSession | undefined, permissionKeys: string[]): void {
  if (!isSuperAdmin(actor)) {
    const attemptedDevPerms = permissionKeys.filter((k) => DEVELOPER_ONLY_PERMISSIONS.includes(k));
    if (attemptedDevPerms.length > 0) {
      throw HttpError.forbidden(
        `Cannot grant developer-only permissions: ${attemptedDevPerms.join(', ')}`
      );
    }
  }
}

/** Validate whether actor is permitted to manage target user */
export function assertCanManageUser(
  actor: AuthSession | undefined,
  targetUser: {
    role_name?: string;
    roles?: Array<{ name: string }>;
    branch_id?: number | null;
    reseller_id?: number | null;
    organization_id?: number | null;
  }
): void {
  if (!actor) {
    throw HttpError.unauthorized();
  }

  // Developer Super Admin can manage anyone
  if (isSuperAdmin(actor)) {
    return;
  }

  // Target is Super Admin -> Blocked for non-super_admin
  const isTargetSuperAdmin =
    targetUser.role_name === 'super_admin' ||
    (Array.isArray(targetUser.roles) && targetUser.roles.some((r) => r.name === 'super_admin'));
  if (isTargetSuperAdmin) {
    throw HttpError.forbidden('Cannot view or modify Developer Super Admin accounts');
  }

  // Branch isolation
  if (actor.userType === 'branch' || actor.dataScope === 'BRANCH') {
    if (targetUser.branch_id !== actor.branchId) {
      throw HttpError.forbidden('Cannot manage users outside your assigned branch');
    }
  }

  // Reseller isolation
  if (actor.userType === 'reseller' || actor.dataScope === 'RESELLER') {
    if (targetUser.reseller_id !== actor.resellerId) {
      throw HttpError.forbidden('Cannot manage users outside your assigned reseller');
    }
  }
}

/** Validate whether actor is permitted to access/manage target subscriber */
export function assertCanAccessSubscriber(
  actor: AuthSession | undefined,
  subscriber: { branch_id?: number | null; reseller_id?: number | null }
): void {
  if (!actor || isSuperAdmin(actor) || isIspAdmin(actor)) {
    return;
  }

  if (isBranchUser(actor) && actor.branchId) {
    if (subscriber.branch_id !== actor.branchId) {
      throw HttpError.forbidden('Cannot access subscriber belonging to another branch');
    }
  }

  if (isResellerUser(actor) && actor.resellerId) {
    if (subscriber.reseller_id !== actor.resellerId) {
      throw HttpError.forbidden('Cannot access subscriber belonging to another reseller');
    }
  }
}
