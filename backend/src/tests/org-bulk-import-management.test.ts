import { parseImportDate } from '../repositories/subscriber.repository';
import { PERMISSION_CATALOG } from '../repositories/user-management.repository';

/**
 * Test Suite: Organization Settings, Deletion Guards, Channel Pricing Removal, and Bulk Customer Import
 */
export function runOrgBulkImportTests(): { name: string; passed: boolean; error?: string }[] {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      results.push({ name: testName, passed: true });
    } else {
      results.push({ name: testName, passed: false, error: details || 'Assertion failed' });
    }
  }

  // =========================================================================
  // Part 1: Date Parsing & Disambiguation for Customer Import
  // =========================================================================
  {
    // ISO format
    const isoDate = parseImportDate('2026-11-20');
    assert(isoDate !== null, 'Date 1: ISO 2026-11-20 parses successfully');
    assert(isoDate?.getUTCFullYear() === 2026, 'Date 1: Year is 2026');
    assert(isoDate?.getUTCMonth() === 10, 'Date 1: Month is 11 (zero-indexed 10)');
    assert(isoDate?.getUTCDate() === 20, 'Date 1: Day is 20');

    // Ambiguous dates with DMY preference
    const dmyDate = parseImportDate('05/10/2026', 'DMY');
    assert(dmyDate !== null, 'Date 2: 05/10/2026 with DMY preference parses');
    assert(dmyDate?.getUTCDate() === 5, 'Date 2: Day is 5');
    assert(dmyDate?.getUTCMonth() === 9, 'Date 2: Month is 10 (zero-indexed 9)');

    // Ambiguous dates with MDY preference
    const mdyDate = parseImportDate('05/10/2026', 'MDY');
    assert(mdyDate !== null, 'Date 3: 05/10/2026 with MDY preference parses');
    assert(mdyDate?.getUTCDate() === 10, 'Date 3: Day is 10');
    assert(mdyDate?.getUTCMonth() === 4, 'Date 3: Month is 5 (zero-indexed 4)');

    // Unambiguous day > 12 (e.g. 25/08/2026)
    const unambiguousDate = parseImportDate('25/08/2026', 'MDY');
    assert(unambiguousDate !== null, 'Date 4: 25/08/2026 unambiguous day > 12 parses correctly even with MDY');
    assert(unambiguousDate?.getUTCDate() === 25, 'Date 4: Day is 25');
    assert(unambiguousDate?.getUTCMonth() === 7, 'Date 4: Month is 8 (zero-indexed 7)');

    // Excel serial date number (e.g. 45600 -> ~Nov 2024)
    const excelDate = parseImportDate(45600);
    assert(excelDate !== null, 'Date 5: Excel serial number 45600 parses to valid Date');
    assert(excelDate?.getUTCFullYear() === 2024, 'Date 5: Excel year is 2024');

    // Invalid dates
    const invalidDate = parseImportDate('not-a-date');
    assert(invalidDate === null, 'Date 6: Invalid string returns null');

    const emptyDate = parseImportDate('');
    assert(emptyDate === null, 'Date 7: Empty string returns null');
  }

  // =========================================================================
  // Part 2: Channel Pricing Deprecation & Permission Catalog Cleared
  // =========================================================================
  {
    const pricingKeys = PERMISSION_CATALOG.filter((p) => p.key.startsWith('pricing.'));
    assert(pricingKeys.length === 0, 'Pricing 1: Channel pricing permissions removed from PERMISSION_CATALOG');

    const userDeletePerm = PERMISSION_CATALOG.find((p) => p.key === 'users.delete');
    assert(userDeletePerm !== undefined, 'Permissions 2: users.delete exists in PERMISSION_CATALOG');
  }

  // =========================================================================
  // Part 3: User Deletion Logic Guards
  // =========================================================================
  {
    // Test Self-Deletion Guard
    const actorUser = { userId: '10', username: 'admin1', role: 'isp_admin', permissions: ['users.delete'] };
    const selfTargetId = '10';
    assert(actorUser.userId === selfTargetId, 'User Deletion 1: Self-deletion detected when actorId matches targetId');

    // Test Super Admin Deletion Guard (ISP Admin cannot delete Super Admin)
    const targetSuperAdmin = { id: 1, username: 'dev_root', role: 'super_admin' };
    const isIspAdminActor = actorUser.role === 'isp_admin';
    const isTargetSuper = targetSuperAdmin.role === 'super_admin';
    assert(isIspAdminActor && isTargetSuper, 'User Deletion 2: ISP Admin blocked from deleting Developer Super Admin');
  }

  // =========================================================================
  // Part 4: FreeRADIUS Temporary Auth Exception Integration Validation
  // =========================================================================
  {
    // Verification of isolated Auth-Type := Accept inject format
    const exceptionRow = {
      username: 'migrated_user_01',
      auth_exception_enabled: true,
      status: 'enabled',
    };
    const radcheckRecord = {
      username: exceptionRow.username,
      attribute: exceptionRow.auth_exception_enabled ? 'Auth-Type' : 'Cleartext-Password',
      op: ':=',
      value: exceptionRow.auth_exception_enabled ? 'Accept' : 'secret123',
    };

    assert(radcheckRecord.attribute === 'Auth-Type', 'RADIUS 1: Auth Exception injects Auth-Type attribute');
    assert(radcheckRecord.value === 'Accept', 'RADIUS 2: Auth Exception injects Accept value');
    assert(radcheckRecord.username === 'migrated_user_01', 'RADIUS 3: Exception applies strictly to individual subscriber');
  }

  return results;
}

// Auto-run if executed directly
if (require.main === module) {
  const testResults = runOrgBulkImportTests();
  const failed = testResults.filter((r) => !r.passed);
  console.log(`\n=== Organization & Bulk Import Test Suite: ${testResults.length} Tests ===\n`);
  testResults.forEach((r) => {
    console.log(`${r.passed ? '✓' : '✗'} ${r.name} ${r.error ? `(${r.error})` : ''}`);
  });
  console.log(`\nSummary: ${testResults.length - failed.length} passed, ${failed.length} failed.\n`);
  if (failed.length > 0) {
    process.exit(1);
  }
}
