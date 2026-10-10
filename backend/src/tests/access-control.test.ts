import {
  isSuperAdmin,
  isIspAdmin,
  isBranchUser,
  isResellerUser,
  assertCanAssignRole,
  assertCanGrantPermissions,
  assertCanManageUser,
  DEVELOPER_ONLY_PERMISSIONS,
  DEVELOPER_ONLY_ROLES,
} from '../lib/access-control';
import type { AuthSession } from '../services/auth.service';

/**
 * Verification Test Suite for User Management, Access Control, and RBAC Boundaries
 */
export function runAccessControlTests(): { name: string; passed: boolean; error?: string }[] {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      results.push({ name: testName, passed: true });
    } else {
      results.push({ name: testName, passed: false, error: details || 'Assertion failed' });
    }
  }

  // --- Test 1: Developer Super Admin Identification ---
  {
    const saSession: AuthSession = {
      userId: '1',
      username: 'developer',
      role: 'super_admin',
      permissions: ['*'],
    };
    assert(isSuperAdmin(saSession) === true, 'Test 1: isSuperAdmin true for role=super_admin');
    assert(isIspAdmin(saSession) === true, 'Test 1: isIspAdmin true for super_admin');

    const multiRoleSession: AuthSession = {
      userId: '2',
      username: 'dev_multi',
      role: 'admin',
      roles: ['noc_head', 'super_admin'],
      permissions: [],
    };
    assert(isSuperAdmin(multiRoleSession) === true, 'Test 1: isSuperAdmin true when roles array contains super_admin');
  }

  // --- Test 2: ISP Admin Identification ---
  {
    const ispSession: AuthSession = {
      userId: '3',
      username: 'isp_owner',
      role: 'isp_admin',
      permissions: ['subscribers.view', 'billing.view'],
    };
    assert(isSuperAdmin(ispSession) === false, 'Test 2: isSuperAdmin false for isp_admin');
    assert(isIspAdmin(ispSession) === true, 'Test 2: isIspAdmin true for isp_admin');

    const orgSession: AuthSession = {
      userId: '4',
      username: 'org_admin',
      role: 'organization_admin',
      permissions: [],
    };
    assert(isIspAdmin(orgSession) === true, 'Test 2: isIspAdmin true for organization_admin');
  }

  // --- Test 3: Branch and Reseller Scoping ---
  {
    const branchSession: AuthSession = {
      userId: '5',
      username: 'branch_op',
      role: 'branch_operator',
      userType: 'branch',
      branchId: 10,
      permissions: [],
    };
    assert(isBranchUser(branchSession) === true, 'Test 3: isBranchUser true for branch operator');
    assert(isResellerUser(branchSession) === false, 'Test 3: isResellerUser false for branch operator');

    const resellerSession: AuthSession = {
      userId: '6',
      username: 'reseller_op',
      role: 'reseller_operator',
      userType: 'reseller',
      resellerId: 20,
      permissions: [],
    };
    assert(isResellerUser(resellerSession) === true, 'Test 3: isResellerUser true for reseller operator');
    assert(isBranchUser(resellerSession) === false, 'Test 3: isBranchUser false for reseller operator');
  }

  // --- Test 4: Role Assignment Guard (super_admin cannot be assigned by ISP admin) ---
  {
    const saSession: AuthSession = { userId: '1', username: 'sa', role: 'super_admin', permissions: [] };
    const ispSession: AuthSession = { userId: '2', username: 'isp', role: 'isp_admin', permissions: [] };

    let saAllowed = false;
    try {
      assertCanAssignRole(saSession, 'super_admin');
      saAllowed = true;
    } catch {}
    assert(saAllowed, 'Test 4: Super Admin can assign super_admin role');

    let ispBlocked = false;
    try {
      assertCanAssignRole(ispSession, 'super_admin');
    } catch (err: any) {
      if (err.statusCode === 403) ispBlocked = true;
    }
    assert(ispBlocked, 'Test 4: ISP Admin assigning super_admin throws 403 Forbidden');

    let normalRoleAllowed = false;
    try {
      assertCanAssignRole(ispSession, 'branch_admin');
      normalRoleAllowed = true;
    } catch {}
    assert(normalRoleAllowed, 'Test 4: ISP Admin can assign branch_admin role');
  }

  // --- Test 5: Permission Granting Boundaries ---
  {
    const saSession: AuthSession = { userId: '1', username: 'sa', role: 'super_admin', permissions: [] };
    const ispSession: AuthSession = { userId: '2', username: 'isp', role: 'isp_admin', permissions: [] };

    let saPermAllowed = false;
    try {
      assertCanGrantPermissions(saSession, ['system.developer_config', 'system.diagnostics']);
      saPermAllowed = true;
    } catch {}
    assert(saPermAllowed, 'Test 5: Super Admin can grant developer-only permissions');

    let ispPermBlocked = false;
    try {
      assertCanGrantPermissions(ispSession, ['subscriber.view', 'system.developer_config']);
    } catch (err: any) {
      if (err.statusCode === 403) ispPermBlocked = true;
    }
    assert(ispPermBlocked, 'Test 5: ISP Admin granting developer-only permissions throws 403 Forbidden');

    let ispNormalPermAllowed = false;
    try {
      assertCanGrantPermissions(ispSession, ['subscriber.view', 'billing.view', 'reseller.wallet.topup']);
      ispNormalPermAllowed = true;
    } catch {}
    assert(ispNormalPermAllowed, 'Test 5: ISP Admin granting operational permissions succeeds');
  }

  // --- Test 6: Target User Management Boundaries ---
  {
    const saSession: AuthSession = { userId: '1', username: 'sa', role: 'super_admin', permissions: [] };
    const ispSession: AuthSession = { userId: '2', username: 'isp', role: 'isp_admin', permissions: [] };
    const branchSession: AuthSession = {
      userId: '3',
      username: 'b1_admin',
      role: 'branch_admin',
      userType: 'branch',
      branchId: 101,
      permissions: [],
    };

    // Non-super admin cannot manage Super Admin
    let manageSaBlocked = false;
    try {
      assertCanManageUser(ispSession, { role_name: 'super_admin' });
    } catch (err: any) {
      if (err.statusCode === 403) manageSaBlocked = true;
    }
    assert(manageSaBlocked, 'Test 6: ISP Admin modifying Super Admin throws 403 Forbidden');

    // Super Admin can manage Super Admin
    let saManageSaAllowed = false;
    try {
      assertCanManageUser(saSession, { role_name: 'super_admin' });
      saManageSaAllowed = true;
    } catch {}
    assert(saManageSaAllowed, 'Test 6: Super Admin can manage Super Admin user');

    // Branch Admin cannot manage user outside their branch
    let crossBranchBlocked = false;
    try {
      assertCanManageUser(branchSession, { branch_id: 102, role_name: 'branch_operator' });
    } catch (err: any) {
      if (err.statusCode === 403) crossBranchBlocked = true;
    }
    assert(crossBranchBlocked, 'Test 6: Branch user managing another branch staff throws 403 Forbidden');

    // Branch Admin can manage user in their own branch
    let ownBranchAllowed = false;
    try {
      assertCanManageUser(branchSession, { branch_id: 101, role_name: 'branch_operator' });
      ownBranchAllowed = true;
    } catch {}
    assert(ownBranchAllowed, 'Test 6: Branch user managing own branch staff succeeds');
  }

  return results;
}
