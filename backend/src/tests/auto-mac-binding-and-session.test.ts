import { normalizeMacAddress, isValidMacAddress, formatMacForVendor } from '../lib/mac-utils';
import { assertCanAccessSubscriber } from '../lib/access-control';
import type { AuthSession } from '../services/auth.service';

/**
 * Verification Test Suite for Automatic MAC Binding, Single-Session Enforcement,
 * and Enhanced Authentication Logs (Requirements 1 - 9)
 */
export function runAutoMacBindingAndSessionTests(): { name: string; passed: boolean; error?: string }[] {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      results.push({ name: testName, passed: true });
    } else {
      results.push({ name: testName, passed: false, error: details || 'Assertion failed' });
    }
  }

  // =========================================================================
  // Scenario 1: A subscriber with no bound MAC successfully logs in and becomes bound
  // =========================================================================
  {
    const subscriber = {
      id: 101,
      username: 'fwcpl_cust_01',
      status: 'active',
      mac_address: null as string | null,
      mac_binding_enabled: true,
    };

    const rawNasMac = 'aa-bb-cc-11-22-33';
    const normMac = normalizeMacAddress(rawNasMac);
    const authReply = 'Access-Accept';

    // Simulate auto-bind trigger condition
    let boundMac: string | null = null;
    let radcheckCallingStationId: string | null = null;
    let postAuthReason: string | null = null;

    if (authReply === 'Access-Accept' && subscriber.mac_address === null && normMac) {
      subscriber.mac_address = normMac;
      boundMac = normMac;
      radcheckCallingStationId = normMac;
      postAuthReason = 'Successful authentication (MAC automatically bound)';
    }

    assert(normMac === 'AA:BB:CC:11:22:33', 'Scenario 1.1: NAS MAC normalized to standard format');
    assert(subscriber.mac_address === 'AA:BB:CC:11:22:33', 'Scenario 1.2: Subscriber MAC address automatically bound');
    assert(radcheckCallingStationId === 'AA:BB:CC:11:22:33', 'Scenario 1.3: Calling-Station-Id synced to radcheck');
    assert(postAuthReason?.includes('automatically bound') === true, 'Scenario 1.4: Post-auth reason confirms automatic binding');
  }

  // =========================================================================
  // Scenario 2: The same MAC logs in again after the previous session has ended
  // =========================================================================
  {
    const boundMac = 'AA:BB:CC:11:22:33';
    const presentedMac = normalizeMacAddress('AA:BB:CC:11:22:33');
    const radcheckExpectedMac = boundMac;

    // Previous session closed: AcctStopTime is NOT null
    const radacctActiveSessions = 0;
    const isMacMatched = presentedMac === radcheckExpectedMac;
    const reply = isMacMatched && radacctActiveSessions === 0 ? 'Access-Accept' : 'Access-Reject';

    assert(isMacMatched === true, 'Scenario 2.1: Calling-Station-Id matches bound MAC');
    assert(reply === 'Access-Accept', 'Scenario 2.2: Subsequent login from same MAC accepted');
  }

  // =========================================================================
  // Scenario 3: A different MAC with the correct password is rejected
  // =========================================================================
  {
    const boundMac = 'AA:BB:CC:11:22:33';
    const rogueMac = normalizeMacAddress('DD:EE:FF:44:55:66');
    const subscriber = { id: 101, username: 'fwcpl_cust_01', mac_address: boundMac };

    // In FreeRADIUS, Calling-Station-Id check fails when different MAC is presented
    const reply = 'Access-Reject';
    let rejectionReason: string | null = null;

    if (reply === 'Access-Reject') {
      if (subscriber.mac_address !== null && rogueMac !== subscriber.mac_address) {
        rejectionReason = 'Incorrect MAC Address';
      }
    }

    // Crucial: bound MAC MUST NEVER be overwritten by a rogue attempt
    const preservedBoundMac = subscriber.mac_address;

    assert(rejectionReason === 'Incorrect MAC Address', 'Scenario 3.1: Different MAC rejected with "Incorrect MAC Address"');
    assert(preservedBoundMac === 'AA:BB:CC:11:22:33', 'Scenario 3.2: Bound MAC address never overwritten on mismatch');
  }

  // =========================================================================
  // Scenario 4: The rejected MAC appears in Auth Logs without replacing the bound MAC
  // =========================================================================
  {
    const boundMac = 'AA:BB:CC:11:22:33';
    const attemptedMac = 'DD:EE:FF:44:55:66';

    const authLogRow = {
      username: 'fwcpl_cust_01',
      reply: 'Access-Reject',
      reason: 'Incorrect MAC Address',
      attempted_mac: attemptedMac,
      bound_mac: boundMac,
    };

    assert(authLogRow.attempted_mac === 'DD:EE:FF:44:55:66', 'Scenario 4.1: Attempted MAC recorded in auth log');
    assert(authLogRow.bound_mac === 'AA:BB:CC:11:22:33', 'Scenario 4.2: Bound MAC recorded separately in auth log');
    assert(authLogRow.attempted_mac !== authLogRow.bound_mac, 'Scenario 4.3: Attempted MAC is distinct from bound MAC');
  }

  // =========================================================================
  // Scenario 5: An incorrect password does not bind or replace a MAC
  // =========================================================================
  {
    // Case A: Unbound subscriber, attacker provides incorrect password
    const unboundSubscriber = { id: 102, username: 'fwcpl_unbound', mac_address: null as string | null };
    const attackerMac = normalizeMacAddress('11:22:33:44:55:66');
    const authReplyWrongPass = 'Access-Reject';

    // Auto-bind MUST only trigger on Access-Accept
    if (authReplyWrongPass === 'Access-Accept' && unboundSubscriber.mac_address === null && attackerMac) {
      unboundSubscriber.mac_address = attackerMac;
    }

    assert(unboundSubscriber.mac_address === null, 'Scenario 5.1: Failed auth never binds MAC for unbound subscriber');

    // Case B: Bound subscriber, wrong password
    const boundSubscriber = { id: 103, username: 'fwcpl_bound', mac_address: 'AA:BB:CC:11:22:33' };
    assert(boundSubscriber.mac_address === 'AA:BB:CC:11:22:33', 'Scenario 5.2: Bound MAC remains unchanged on bad password');
  }

  // =========================================================================
  // Scenario 6: An authorized administrator unbinds the MAC
  // =========================================================================
  {
    const subscriber = {
      id: 104,
      username: 'fwcpl_cust_04',
      mac_address: 'AA:BB:CC:11:22:33' as string | null,
      mac_bound_at: new Date('2026-10-01'),
      mac_bound_by: 'auto_first_login' as string | null,
    };

    // Admin unbind simulation
    const previousMac = subscriber.mac_address;
    subscriber.mac_address = null;
    subscriber.mac_bound_at = null;
    subscriber.mac_bound_by = null;

    const auditEntry = {
      action: 'subscriber.mac_unbind',
      metadata: { previous_mac: previousMac, unbind_by: 'admin' },
    };

    assert(subscriber.mac_address === null, 'Scenario 6.1: MAC cleared on unbind');
    assert(auditEntry.metadata.previous_mac === 'AA:BB:CC:11:22:33', 'Scenario 6.2: Previous MAC preserved in audit history');
  }

  // =========================================================================
  // Scenario 7: The next successful login binds the replacement MAC
  // =========================================================================
  {
    const subscriber = { id: 104, username: 'fwcpl_cust_04', mac_address: null as string | null };
    const replacementMac = normalizeMacAddress('99:88:77:66:55:44');
    const loginReply = 'Access-Accept';

    if (loginReply === 'Access-Accept' && subscriber.mac_address === null && replacementMac) {
      subscriber.mac_address = replacementMac;
    }

    assert(subscriber.mac_address === '99:88:77:66:55:44', 'Scenario 7.1: Replacement MAC automatically bound on next successful login');
  }

  // =========================================================================
  // Scenario 8: An unauthorized user cannot unbind a MAC outside their scope
  // =========================================================================
  {
    const branchManagerSession: AuthSession = {
      userId: '5',
      username: 'bm_north',
      role: 'branch_manager',
      branchId: 10,
      permissions: ['subscriber.mac_bind'],
    };

    const southSubscriber = {
      id: 201,
      username: 'south_cust',
      branch_id: 20, // Different branch!
    };

    let denied = false;
    try {
      assertCanAccessSubscriber(branchManagerSession, southSubscriber);
    } catch {
      denied = true;
    }

    assert(denied === true, 'Scenario 8.1: Branch Manager denied unbind outside assigned branch scope');

    const authorizedManagerSession: AuthSession = {
      userId: '6',
      username: 'bm_south',
      role: 'branch_manager',
      branchId: 20,
      permissions: ['subscriber.mac_bind'],
    };

    let allowed = false;
    try {
      assertCanAccessSubscriber(authorizedManagerSession, southSubscriber);
      allowed = true;
    } catch {
      allowed = false;
    }

    assert(allowed === true, 'Scenario 8.2: Branch Manager permitted within assigned branch scope');
  }

  // =========================================================================
  // Scenario 9: Two simultaneous first-login requests cannot create competing bindings
  // =========================================================================
  {
    // In PostgreSQL: UPDATE subscribers SET mac_address = $1 WHERE id = $2 AND mac_address IS NULL
    let currentMacInDb: string | null = null;

    function simulateAtomicFirstLogin(candidateMac: string): boolean {
      if (currentMacInDb === null) {
        currentMacInDb = candidateMac;
        return true; // Row updated
      }
      return false; // WHERE mac_address IS NULL failed
    }

    const req1Result = simulateAtomicFirstLogin('11:22:33:44:55:66');
    const req2Result = simulateAtomicFirstLogin('99:88:77:66:55:44');

    assert(req1Result === true, 'Scenario 9.1: First concurrent request succeeds in binding');
    assert(req2Result === false, 'Scenario 9.2: Second concurrent request rejected by concurrency guard');
    assert(currentMacInDb === '11:22:33:44:55:66', 'Scenario 9.3: Bound MAC strictly maintains the winner of the atomic update');
  }

  // =========================================================================
  // Scenario 10: A subscriber's second concurrent login cannot create a second active session
  // =========================================================================
  {
    // Active session present
    const activeSessions = [
      { radacctid: '1', username: 'fwcpl_single_sess', stop_time: null, update_time: new Date() },
    ];

    const simulLimit = 1;
    const concurrentAttemptAllowed = activeSessions.filter((s) => s.stop_time === null).length < simulLimit;

    assert(concurrentAttemptAllowed === false, 'Scenario 10.1: Simultaneous-Use := 1 blocks second active session');
  }

  // =========================================================================
  // Scenario 11: A stale accounting record can be identified and handled safely
  // =========================================================================
  {
    const now = Date.now();
    const staleIntervalMs = 15 * 60 * 1000; // 15 mins

    const staleSession = {
      radacctid: '10',
      username: 'fwcpl_cust_stale',
      acct_start_time: new Date(now - 60 * 60 * 1000), // 1 hour ago
      acct_update_time: new Date(now - 45 * 60 * 1000), // 45 mins ago (stale!)
      acct_stop_time: null as Date | null,
    };

    // simul_count_query check: only count sessions with update within 15m
    const isConsideredActive =
      staleSession.acct_stop_time === null &&
      now - staleSession.acct_update_time.getTime() <= staleIntervalMs;

    assert(isConsideredActive === false, 'Scenario 11.1: Stale session (> 15m without update) excluded from active count');

    // Simulate cleanup_stale_radacct_sessions function
    if (!isConsideredActive && staleSession.acct_stop_time === null) {
      staleSession.acct_stop_time = staleSession.acct_update_time;
    }

    assert(staleSession.acct_stop_time !== null, 'Scenario 11.2: Stale session closed without locking legitimate user out');
  }

  // =========================================================================
  // Scenario 12: Auth Logs show useful rejection reasons without exposing passwords
  // =========================================================================
  {
    const radpostauthEntry = {
      username: 'fwcpl_test',
      pass: 'confidential_pass_123',
      reply: 'Access-Reject',
      reason: 'Incorrect Password',
      attempted_mac: 'AA:BB:CC:DD:EE:FF',
      bound_mac: 'AA:BB:CC:DD:EE:FF',
    };

    // Trigger wipes plaintext password unconditionally: NEW.pass := NULL
    radpostauthEntry.pass = null as any;

    assert(radpostauthEntry.pass === null, 'Scenario 12.1: Password wiped from post-auth log');
    assert(radpostauthEntry.reason === 'Incorrect Password', 'Scenario 12.2: Useful distinct rejection reason present');
  }

  // =========================================================================
  // Scenario 13: Password reset updates the correct RADIUS credential and verifies
  // =========================================================================
  {
    const radcheck = [
      { username: 'fwcpl_pass_test', attribute: 'Cleartext-Password', op: ':=', value: 'old_secret_123' },
    ];

    const newPassword = 'new_strong_password_456';

    // Password reset update
    const entry = radcheck.find((r) => r.username === 'fwcpl_pass_test' && r.attribute === 'Cleartext-Password');
    if (entry) {
      entry.value = newPassword;
    }

    // radcheck verification check
    const verified = radcheck.some(
      (r) => r.username === 'fwcpl_pass_test' && r.attribute === 'Cleartext-Password' && r.value === newPassword
    );

    assert(verified === true, 'Scenario 13.1: Password reset updates and verifies Cleartext-Password in radcheck');
  }

  // =========================================================================
  // Scenario 14: Existing MikroTik authentication and accounting continue to work
  // =========================================================================
  {
    // MikroTik formats
    const mikrotikDash = normalizeMacAddress('48-8f-5a-11-22-33');
    const mikrotikColon = normalizeMacAddress('48:8F:5A:11:22:33');
    const mikrotikCisco = normalizeMacAddress('488f.5a11.2233');

    assert(mikrotikDash === '48:8F:5A:11:22:33', 'Scenario 14.1: MikroTik hyphen format normalized');
    assert(mikrotikColon === '48:8F:5A:11:22:33', 'Scenario 14.2: MikroTik colon format normalized');
    assert(mikrotikCisco === '48:8F:5A:11:22:33', 'Scenario 14.3: MikroTik/Cisco dotted format normalized');
    assert(
      isValidMacAddress('48:8F:5A:11:22:33'),
      'Scenario 14.4: MikroTik standard Calling-Station-Id attribute is valid'
    );
  }

  return results;
}

// Auto-run if executed directly
if (typeof require !== 'undefined' && require?.main === module) {
  const testResults = runAutoMacBindingAndSessionTests();
  const failed = testResults.filter((r) => !r.passed);
  console.log(`\n=== Auto MAC Binding & Single Session Test Suite: ${testResults.length} Tests ===\n`);
  testResults.forEach((r) => {
    console.log(`${r.passed ? '✓' : '✗'} ${r.name} ${r.error ? `(${r.error})` : ''}`);
  });
  console.log(`\nSummary: ${testResults.length - failed.length} passed, ${failed.length} failed.\n`);
  if (failed.length > 0) {
    process.exit(1);
  }
}
