import { deviceIdentityService } from '../services/onu/device-identity.service';
import { validateOnuTargetIp } from '../services/onu/onu-http-client';
import { encryptSecret, decryptSecret, maskSecret, sanitizeLogOutput } from '../lib/crypto';
import { getOnuAdapter } from '../services/onu/adapters/adapter-factory';
import { OnuHttpClient } from '../services/onu/onu-http-client';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export async function runOnuManagementTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  const runSync = (name: string, fn: () => void) => {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message });
    }
  };

  const runAsync = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message });
    }
  };

  const assert = (condition: boolean, msg: string) => {
    if (!condition) throw new Error(msg);
  };

  // =========================================================================
  // 1. Vendor & Model Detection Heuristics
  // =========================================================================

  runSync('Test 1: Identifies Huawei ONT from HWTC serial prefix', () => {
    const id = deviceIdentityService.identifyOnu({
      serialNumber: 'HWTC1234ABCD',
      equipmentId: 'HG8145V5',
    });
    assert(id.vendor === 'Huawei', `Expected Huawei, got ${id.vendor}`);
    assert(id.model === 'HG8145V5', `Expected HG8145V5, got ${id.model}`);
    assert(id.managementStatus === 'unconfigured', `Expected unconfigured, got ${id.managementStatus}`);
  });

  runSync('Test 2: Identifies ZTE ONT from ZTEG serial prefix', () => {
    const id = deviceIdentityService.identifyOnu({
      serialNumber: 'ZTEG98765432',
      equipmentId: 'F670L',
    });
    assert(id.vendor === 'ZTE', `Expected ZTE, got ${id.vendor}`);
    assert(id.model === 'F670L', `Expected F670L, got ${id.model}`);
  });

  runSync('Test 3: Identifies Fiberhome ONT from FHTT serial prefix', () => {
    const id = deviceIdentityService.identifyOnu({
      serialNumber: 'FHTT00112233',
      equipmentId: 'AN5506-02',
    });
    assert(id.vendor === 'Fiberhome', `Expected Fiberhome, got ${id.vendor}`);
    assert(id.model === 'AN5506-02', `Expected AN5506-02, got ${id.model}`);
  });

  runSync('Test 4: Identifies BDCOM ONT from BDCM serial prefix', () => {
    const id = deviceIdentityService.identifyOnu({
      serialNumber: 'BDCM44556677',
      equipmentId: 'GP1704',
    });
    assert(id.vendor === 'BDCOM', `Expected BDCOM, got ${id.vendor}`);
    assert(id.model === 'GP1704', `Expected GP1704, got ${id.model}`);
  });

  runSync('Test 5: Identifies Hex serial prefixes (48575443 -> HWTC, 5A544547 -> ZTEG)', () => {
    const idHw = deviceIdentityService.identifyOnu({
      serialNumber: '48575443AABBCCDD',
      equipmentId: 'EG8145V5',
    });
    assert(idHw.vendor === 'Huawei', `Expected Huawei for 48575443, got ${idHw.vendor}`);
    assert(idHw.model === 'EG8145V5', `Expected EG8145V5, got ${idHw.model}`);

    const idZte = deviceIdentityService.identifyOnu({
      serialNumber: '5A54454711223344',
      description: 'ZTE F660 ONT in living room',
    });
    assert(idZte.vendor === 'ZTE', `Expected ZTE for 5A544547, got ${idZte.vendor}`);
    assert(idZte.model === 'F660', `Expected F660 from description, got ${idZte.model}`);
  });

  runSync('Test 6: Flags unclassified or unknown hardware as pending_profile', () => {
    const id = deviceIdentityService.identifyOnu({
      serialNumber: 'XYZK99887766',
      equipmentId: 'Unknown-Custom-Box',
    });
    assert(id.vendor === 'Other', `Expected Other vendor, got ${id.vendor}`);
    assert(id.managementStatus === 'pending_profile', `Expected pending_profile, got ${id.managementStatus}`);
  });

  // =========================================================================
  // 2. SSRF Protection & Private Management Subnet Filtering
  // =========================================================================

  runSync('Test 7: Allows valid RFC 1918 and RFC 6598 management IPs', () => {
    const validIps = [
      '192.168.1.1',
      '192.168.100.1',
      '10.0.0.1',
      '10.254.12.34',
      '172.16.0.1',
      '172.31.255.254',
      '100.64.0.1', // CGNAT RFC 6598
      '100.127.255.254',
    ];

    for (const ip of validIps) {
      validateOnuTargetIp(ip); // Should not throw
    }
  });

  runSync('Test 8: Strictly blocks loopback, localhost, and 127.0.0.0/8', () => {
    const loopbacks = ['127.0.0.1', 'localhost', '127.0.0.2', '127.255.255.255'];
    for (const ip of loopbacks) {
      let threw = false;
      try {
        validateOnuTargetIp(ip);
      } catch {
        threw = true;
      }
      assert(threw, `Loopback ${ip} must be blocked`);
    }
  });

  runSync('Test 9: Strictly blocks cloud metadata (169.254.169.254)', () => {
    const metadataIps = ['169.254.169.254', '169.254.1.1', 'metadata.google.internal'];
    for (const ip of metadataIps) {
      let threw = false;
      try {
        validateOnuTargetIp(ip);
      } catch {
        threw = true;
      }
      assert(threw, `Metadata ${ip} must be blocked`);
    }
  });

  runSync('Test 10: Strictly blocks public Internet IPs and multicast/broadcast', () => {
    const forbidden = ['8.8.8.8', '1.1.1.1', '224.0.0.1', '255.255.255.255', '0.0.0.0'];
    for (const ip of forbidden) {
      let threw = false;
      try {
        validateOnuTargetIp(ip);
      } catch {
        threw = true;
      }
      assert(threw, `Target ${ip} must be blocked`);
    }
  });

  // =========================================================================
  // 3. Cryptographic Storage & Masking
  // =========================================================================

  runSync('Test 11: AES-256-GCM encryption and decryption round-trip', () => {
    const secret = 'AdminPassSecret123!';
    const enc = encryptSecret(secret);
    assert(enc.startsWith('aes256gcm:'), 'Ciphertext must start with aes256gcm:');
    assert(enc !== secret, 'Ciphertext must not be plaintext');

    const dec = decryptSecret(enc);
    assert(dec === secret, 'Decrypted value must match original plaintext');
  });

  runSync('Test 12: Secret masking and audit log sanitization', () => {
    const plain = 'SuperSecretWiFiPassword99';
    const masked = maskSecret(plain);
    assert(masked === '••••••••', `Mask must be bullet points, got ${masked}`);
    assert(!masked.includes(plain), 'Mask must never contain original password');

    const rawLog = `POST /wifi password=${plain} host=192.168.1.1`;
    const sanitized = sanitizeLogOutput(rawLog, [plain]);
    assert(!sanitized.includes(plain), 'Sanitized output must redact password');
    assert(sanitized.includes('[REDACTED]'), 'Sanitized output must include [REDACTED]');
  });

  // =========================================================================
  // 4. Modular Adapter Architecture
  // =========================================================================

  runSync('Test 13: Adapter Factory resolves registered web adapters', () => {
    const hwAdapter = getOnuAdapter('huawei_web');
    assert(hwAdapter.adapterType === 'huawei_web', 'Expected huawei_web');

    const zteAdapter = getOnuAdapter('zte_web');
    assert(zteAdapter.adapterType === 'zte_web', 'Expected zte_web');

    const genericAdapter = getOnuAdapter('generic_web');
    assert(genericAdapter.adapterType === 'generic_web', 'Expected generic_web');

    const unsupportedAdapter = getOnuAdapter('unsupported');
    assert(unsupportedAdapter.adapterType === 'unsupported', 'Expected unsupported');
  });

  await runAsync('Test 14: Unsupported adapter returns graceful capability failure', async () => {
    const client = new OnuHttpClient('192.168.1.1', 80, 'http');
    const adapter = getOnuAdapter('unsupported');

    const testRes = await adapter.testProfile(client, 'user', 'pass');
    assert(testRes.auth === false, 'Auth must be false for unsupported adapter');
    assert(testRes.message?.includes('configuration') ?? false, 'Must provide descriptive unsupported message');
  });

  return results;
}

// Auto-run test suite
runOnuManagementTests().then((testResults) => {
  const failed = testResults.filter((r) => !r.passed);
  console.log(`\n=== ONU Web Management Test Suite: ${testResults.length} Tests ===\n`);
  testResults.forEach((r) => {
    console.log(`${r.passed ? '✓' : '✗'} ${r.name} ${r.error ? `(${r.error})` : ''}`);
  });
  console.log(`\nSummary: ${testResults.length - failed.length} passed, ${failed.length} failed.\n`);
  if (failed.length > 0) {
    process.exit(1);
  }
});
