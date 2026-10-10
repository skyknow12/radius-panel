import {
  isSuperAdmin,
  isIspAdmin,
  isBranchUser,
  isResellerUser,
  assertCanAssignRole,
  assertCanGrantPermissions,
  assertCanManageUser,
  assertCanAccessSubscriber,
  DEVELOPER_ONLY_PERMISSIONS,
} from '../lib/access-control';
import { envelope } from '../lib/response';
import type { AuthSession } from '../services/auth.service';

/**
 * Acceptance Test Suite for Default Roles and Permissions
 * (Super Admin — Developer, ISP Admin, Branch Manager)
 */
export function runDefaultRolesTests(): { name: string; passed: boolean; error?: string }[] {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      results.push({ name: testName, passed: true });
    } else {
      results.push({ name: testName, passed: false, error: details || 'Assertion failed' });
    }
  }

  // --- 1. Response Envelope Integrity (Frontend Compatibility) ---
  {
    const singleObj = { id: 1, name: 'super_admin' };
    const env = envelope(singleObj);
    assert(env.success === true, 'Envelope 1: envelope returns success: true');
    assert(env.data.id === 1, 'Envelope 2: envelope preserves data payload');
  }

  // --- 2. Developer Super Admin Verification ---
  {
    const superAdminSession: AuthSession = {
      userId: '1',
      username: 'developer',
      role: 'super_admin',
      roles: ['super_admin'],
      permissions: ['*'],
    };

    assert(isSuperAdmin(superAdminSession) === true, 'Super Admin 1: Recognized as super admin');
    assert(isIspAdmin(superAdminSession) === true, 'Super Admin 2: Super admin inherits ISP admin privileges');

    // Super Admin can assign any role and any permission
    let assignAllowed = false;
    try {
      assertCanAssignRole(superAdminSession, 'super_admin');
      assertCanGrantPermissions(superAdminSession, DEVELOPER_ONLY_PERMISSIONS);
      assignAllowed = true;
    } catch {}
    assert(assignAllowed === true, 'Super Admin 3: Permitted to assign developer-only roles and permissions');
  }

  // --- 3. ISP Admin Scoping & Developer Protection ---
  {
    const ispAdminSession: AuthSession = {
      userId: '2',
      username: 'isp_owner',
      role: 'isp_admin',
      roles: ['isp_admin'],
      permissions: [
        'dashboard.view',
        'subscribers.view',
        'package.create',
        'nas.create',
        'billing.recharge',
      ],
    };

    assert(isSuperAdmin(ispAdminSession) === false, 'ISP Admin 1: Not recognized as developer super admin');
    assert(isIspAdmin(ispAdminSession) === true, 'ISP Admin 2: Recognized as ISP admin');

    // ISP Admin cannot assign super_admin
    let blockedSuperAdminAssign = false;
    try {
      assertCanAssignRole(ispAdminSession, 'super_admin');
    } catch (e: any) {
      blockedSuperAdminAssign = e.statusCode === 403;
    }
    assert(blockedSuperAdminAssign === true, 'ISP Admin 3: Blocked from assigning super_admin role');

    // ISP Admin cannot grant developer-only permissions
    let blockedDevPerms = false;
    try {
      assertCanGrantPermissions(ispAdminSession, ['system.developer_config', 'system.diagnostics']);
    } catch (e: any) {
      blockedDevPerms = e.statusCode === 403;
    }
    assert(blockedDevPerms === true, 'ISP Admin 4: Blocked from granting developer-only permissions');

    // ISP Admin cannot modify super_admin accounts
    let blockedManageSuperAdmin = false;
    try {
      assertCanManageUser(ispAdminSession, { role_name: 'super_admin' });
    } catch (e: any) {
      blockedManageSuperAdmin = e.statusCode === 403;
    }
    assert(blockedManageSuperAdmin === true, 'ISP Admin 5: Blocked from managing super_admin accounts');
  }

  // --- 4. Branch Manager Assigned to Branch ---
  {
    const branchManagerBranchSession: AuthSession = {
      userId: '10',
      username: 'bm_pokhara',
      role: 'branch_manager',
      roles: ['branch_manager'],
      userType: 'branch',
      branchId: 5,
      dataScope: 'BRANCH',
      permissions: [
        'dashboard.view',
        'subscriber.view',
        'subscriber.create',
        'subscriber.recharge',
        'package.view',
      ],
    };

    assert(isSuperAdmin(branchManagerBranchSession) === false, 'BM Branch 1: Not super admin');
    assert(isIspAdmin(branchManagerBranchSession) === false, 'BM Branch 2: Not isp admin');
    assert(isBranchUser(branchManagerBranchSession) === true, 'BM Branch 3: Scoped to branch');
    assert(isResellerUser(branchManagerBranchSession) === false, 'BM Branch 4: Not scoped to reseller');

    // Allowed to access subscriber in branch 5
    let branch5SubAllowed = false;
    try {
      assertCanAccessSubscriber(branchManagerBranchSession, { branch_id: 5, reseller_id: null });
      branch5SubAllowed = true;
    } catch {}
    assert(branch5SubAllowed === true, 'BM Branch 5: Can access subscriber in assigned branch');

    // Blocked from subscriber in branch 6
    let branch6SubBlocked = false;
    try {
      assertCanAccessSubscriber(branchManagerBranchSession, { branch_id: 6, reseller_id: null });
    } catch (e: any) {
      branch6SubBlocked = e.statusCode === 403;
    }
    assert(branch6SubBlocked === true, 'BM Branch 6: Blocked from subscriber in another branch');
  }

  // --- 5. Branch Manager Assigned to Reseller ---
  {
    const branchManagerResellerSession: AuthSession = {
      userId: '20',
      username: 'bm_reseller_abc',
      role: 'branch_manager',
      roles: ['branch_manager'],
      userType: 'reseller',
      resellerId: 8,
      dataScope: 'RESELLER',
      permissions: [
        'dashboard.view',
        'subscriber.view',
        'subscriber.recharge',
      ],
    };

    assert(isBranchUser(branchManagerResellerSession) === false, 'BM Reseller 1: Not scoped to branch');
    assert(isResellerUser(branchManagerResellerSession) === true, 'BM Reseller 2: Scoped to reseller');

    // Allowed to access subscriber in reseller 8
    let reseller8SubAllowed = false;
    try {
      assertCanAccessSubscriber(branchManagerResellerSession, { branch_id: null, reseller_id: 8 });
      reseller8SubAllowed = true;
    } catch {}
    assert(reseller8SubAllowed === true, 'BM Reseller 3: Can access subscriber in assigned reseller');

    // Blocked from subscriber in reseller 9
    let reseller9SubBlocked = false;
    try {
      assertCanAccessSubscriber(branchManagerResellerSession, { branch_id: null, reseller_id: 9 });
    } catch (e: any) {
      reseller9SubBlocked = e.statusCode === 403;
    }
    assert(reseller9SubBlocked === true, 'BM Reseller 4: Blocked from subscriber in another reseller');
  }

  return results;
}
