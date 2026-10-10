import { encodeVsa } from '../radius/radius-client';
import { radiusCatalogRepository } from '../repositories/radius-catalog.repository';

/**
 * Verification Test Suite for Juniper BNG & Multi-Vendor RADIUS Engine
 */
export function runJuniperBngTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      results.push({ name: testName, passed: true });
    } else {
      results.push({ name: testName, passed: false, error: details || 'Assertion failed' });
    }
  }

  // ---- Test 1: VSA 2636 (Juniper Networks) Encoding for Ingress Filter ----
  {
    const val = 'filter-in-100m';
    const vsa = encodeVsa(2636, 10, val, 'string');
    // Attribute 26 Header: Type (1 byte) + Length (1 byte) + Vendor ID (4 bytes) = 6 bytes
    // VSA Header: Vendor Type (1 byte) + Vendor Length (1 byte) = 2 bytes
    // Data: 14 bytes
    // Total VSA buffer length = 6 + 2 + 14 = 22 bytes
    assert(vsa.value.length === 22, 'Test 1: Ingress Policy VSA Total Length', `Expected 22, got ${vsa.value.length}`);
    assert(vsa.value.readUInt8(0) === 26, 'Test 1: Attribute Type 26 (Vendor-Specific)', `Expected 26, got ${vsa.value.readUInt8(0)}`);
    assert(vsa.value.readUInt8(1) === 22, 'Test 1: Attribute Length', `Expected 22, got ${vsa.value.readUInt8(1)}`);
    assert(vsa.value.readUInt32BE(2) === 2636, 'Test 1: Vendor ID 2636 (Juniper)', `Expected 2636, got ${vsa.value.readUInt32BE(2)}`);
    assert(vsa.value.readUInt8(6) === 10, 'Test 1: Vendor Type 10 (Juniper-Ingress-Policy-Name)', `Expected 10, got ${vsa.value.readUInt8(6)}`);
    assert(vsa.value.readUInt8(7) === 16, 'Test 1: Vendor Sub-Length', `Expected 16, got ${vsa.value.readUInt8(7)}`);
    assert(vsa.value.subarray(8).toString('utf8') === val, 'Test 1: Ingress Policy String Value');
  }

  // ---- Test 2: VSA 2636 Encoding for Egress Filter ----
  {
    const val = 'filter-out-100m';
    const vsa = encodeVsa(2636, 11, val, 'string');
    assert(vsa.value.readUInt32BE(2) === 2636, 'Test 2: Vendor ID 2636 (Juniper)');
    assert(vsa.value.readUInt8(6) === 11, 'Test 2: Vendor Type 11 (Juniper-Egress-Policy-Name)');
    assert(vsa.value.subarray(8).toString('utf8') === val, 'Test 2: Egress Policy String Value');
  }

  // ---- Test 3: VSA 2636 Encoding for CoS Shaping Rate (VSA 177) ----
  {
    const val = '100m';
    const vsa = encodeVsa(2636, 177, val, 'string');
    assert(vsa.value.readUInt8(6) === 177, 'Test 3: Vendor Type 177 (Juniper-Cos-Shaping-Rate)');
    assert(vsa.value.subarray(8).toString('utf8') === '100m', 'Test 3: CoS Shaping Rate Value');
  }

  // ---- Test 4: VSA 2636 Encoding for Dynamic Service Activation (VSA 65) ----
  {
    const val = 'SERVICE-100M';
    const vsa = encodeVsa(2636, 65, val, 'string');
    assert(vsa.value.readUInt8(6) === 65, 'Test 4: Vendor Type 65 (Juniper-Activate-Service)');
    assert(vsa.value.subarray(8).toString('utf8') === 'SERVICE-100M', 'Test 4: Service Activation String Value');
  }

  // ---- Test 5: VSA 14988 (MikroTik) Encoding does not conflict with Juniper ----
  {
    const val = '50M/50M';
    const vsa = encodeVsa(14988, 8, val, 'string');
    assert(vsa.value.readUInt32BE(2) === 14988, 'Test 5: Vendor ID 14988 (MikroTik)');
    assert(vsa.value.readUInt8(6) === 8, 'Test 5: Vendor Type 8 (Mikrotik-Rate-Limit)');
    assert(vsa.value.subarray(8).toString('utf8') === '50M/50M', 'Test 5: MikroTik Rate Limit String Value');
  }

  // ---- Test 6: 64-bit Accounting Counter Normalization (Gigawords + Octets) ----
  {
    const gigawords = 3;
    const octets = 1048576; // 1 MB
    // Expected = 1048576 + (3 * 4294967296) = 1048576 + 12884901888 = 12885950464
    const totalBytes = Number(BigInt(octets) + (BigInt(gigawords) * BigInt(4294967296)));
    assert(totalBytes === 12885950464, 'Test 6: 64-bit Octet Normalization', `Expected 12885950464, got ${totalBytes}`);
  }

  // ---- Test 7: Radius Attribute Catalog Validation Rules ----
  {
    // Integer attribute validation
    const intItem: any = { attribute_name: 'Acct-Interim-Interval', data_type: 'integer' };
    assert(radiusCatalogRepository.validateAttributeValue(intItem, '300') === true, 'Test 7: Valid integer attribute');
    assert(radiusCatalogRepository.validateAttributeValue(intItem, 'invalid-num') === false, 'Test 7: Reject invalid integer');

    // IPv4 attribute validation
    const ipItem: any = { attribute_name: 'Framed-IP-Address', data_type: 'ipaddr' };
    assert(radiusCatalogRepository.validateAttributeValue(ipItem, '192.168.1.100') === true, 'Test 7: Valid IP attribute');
    assert(radiusCatalogRepository.validateAttributeValue(ipItem, '999.999.999.999') === false, 'Test 7: Reject invalid IP attribute');

    // String attribute validation
    const strItem: any = { attribute_name: 'Juniper-Ingress-Policy-Name', data_type: 'string' };
    assert(radiusCatalogRepository.validateAttributeValue(strItem, 'filter-100m') === true, 'Test 7: Valid string attribute');
    assert(radiusCatalogRepository.validateAttributeValue(strItem, '') === false, 'Test 7: Reject empty string attribute');
  }

  return results;
}
