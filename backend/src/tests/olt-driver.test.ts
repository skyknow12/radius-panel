import { huaweiParser } from '../services/olt/huawei-parser';
import { encryptSecret, decryptSecret, maskSecret, sanitizeLogOutput } from '../lib/crypto';

export function runOltDriverTests(): { name: string; passed: boolean; error?: string }[] {
  const tests: { name: string; passed: boolean; error?: string }[] = [];

  const runTest = (name: string, fn: () => void) => {
    try {
      fn();
      tests.push({ name, passed: true });
    } catch (err: any) {
      tests.push({ name, passed: false, error: err.message });
    }
  };

  // 1. Board parsing test
  runTest('HuaweiParser: parseBoards correctly identifies GPON and control boards on MA5683T', () => {
    const fixture = `
  -------------------------------------------------------------------------
  SlotID  BoardName  Status         SubType0 SubType1    Online/Offline
  -------------------------------------------------------------------------
  0       H805GPFD   Normal                               
  1                                                       
  2       H805GPFD   Normal                               
  3       H805GPFD   Normal                               
  4                                                       
  5       H805GPFD   Normal                               
  6       H802SCUN   Standby_normal                       
  7       H802SCUN   Active_normal                        
  8       H801GICF   Normal                               
  9       H801X2CS   Normal                               
  -------------------------------------------------------------------------
    `;

    const boards = huaweiParser.parseBoards(fixture);
    if (boards.length !== 8) throw new Error(`Expected 8 boards, got ${boards.length}`);
    const gponBoards = boards.filter((b) => b.isGpon);
    if (gponBoards.length !== 4) throw new Error(`Expected 4 GPON boards, got ${gponBoards.length}`);
    if (!gponBoards.some((b) => b.slot === 0 && b.boardName === 'H805GPFD')) throw new Error('Slot 0 GPON not found');
    if (!gponBoards.some((b) => b.slot === 5 && b.boardName === 'H805GPFD')) throw new Error('Slot 5 GPON not found');

    const activeControl = boards.find((b) => b.slot === 7);
    if (!activeControl || !activeControl.isControl || activeControl.status !== 'Active_normal') {
      throw new Error('Active control board in slot 7 not parsed correctly');
    }

    const standbyControl = boards.find((b) => b.slot === 6);
    if (!standbyControl || !standbyControl.isStandby) {
      throw new Error('Standby control board in slot 6 not parsed correctly');
    }
  });

  // 2. Ont info parsing test (block format)
  runTest('HuaweiParser: parseOntInfoAll parses block format registered ONUs', () => {
    const fixture = `
  -----------------------------------------------------------------------------
  F/S/P: 0/0/0
  ONT-ID: 1
  Control flag: active
  Run state: offline
  Config state: initial
  Match state: match
  Protect state: none
  Authentic type: SN-auth
  SN: 485754435F9E5B9E
  Management mode: OMCI
  Description: 9779867523244
  Line profile ID: 2
  Line profile name: line-profile-2
  Service profile ID: 2
  Service profile name: srv-profile-2
  Last up time: 2026-10-09 14:20:10
  Last down time: 2026-10-09 18:32:45
  Last down cause: dying-gasp
  -----------------------------------------------------------------------------
  F/S/P: 0/0/0
  ONT-ID: 2
  Control flag: active
  Run state: online
  Config state: normal
  Match state: match
  Protect state: none
  Authentic type: SN-auth
  SN: 414C434CB35EC25E
  Management mode: OMCI
  Description: customer-fiber-42
  Line profile ID: 2
  Line profile name: line-profile-2
  Service profile ID: 2
  Service profile name: srv-profile-2
  Last up time: 2026-10-11 06:12:00
  -----------------------------------------------------------------------------
    `;

    const onus = huaweiParser.parseOntInfoAll(fixture);
    if (onus.length !== 2) throw new Error(`Expected 2 ONUs, got ${onus.length}`);
    const onu1 = onus[0];
    if (onu1.ontId !== 1 || onu1.serialNumber !== '485754435F9E5B9E') throw new Error('ONU 1 mismatch');
    if (onu1.runState !== 'offline' || onu1.description !== '9779867523244') throw new Error('ONU 1 attributes mismatch');
    if (onu1.lastDownCause !== 'dying-gasp') throw new Error('ONU 1 last down cause mismatch');

    const onu2 = onus[1];
    if (onu2.ontId !== 2 || onu2.runState !== 'online' || onu2.configState !== 'normal') {
      throw new Error('ONU 2 online state mismatch');
    }
  });

  // 3. Ont autofind parsing test
  runTest('HuaweiParser: parseAutofind parses discovered unregistered ONUs', () => {
    const fixture = `
  ----------------------------------------------------------------------------
   Number              : 1
   F/S/P               : 0/2/1
   Ont SN              : 414C434CB35EC25E (ALCL-B35EC25E)
   Password            : 
   Vendor-ID           : ALCL
   Ont Version         : 3FE45678
   Ont SoftwareVersion : 1.0.0
   Ont EquipmentID     : G-140W-ME
   Ont autofind time   : 2026-10-11 08:30:15
  ----------------------------------------------------------------------------
    `;

    const discovered = huaweiParser.parseAutofind(fixture);
    if (discovered.length !== 1) throw new Error(`Expected 1 discovered ONU, got ${discovered.length}`);
    const d = discovered[0];
    if (d.serialNumber !== '414C434CB35EC25E') throw new Error(`Expected SN 414C434CB35EC25E, got ${d.serialNumber}`);
    if (d.slot !== 2 || d.ponPort !== 1) throw new Error(`Expected slot 2 port 1, got slot ${d.slot} port ${d.ponPort}`);
    if (d.vendorId !== 'ALCL' || d.equipmentId !== 'G-140W-ME') throw new Error('Vendor/Equipment mismatch');
  });

  // 4. Autofind empty response handling
  runTest('HuaweiParser: parseAutofind handles empty discovery gracefully without error', () => {
    const emptyFixture = 'Failure: No automatically find ONT is found.';
    const res = huaweiParser.parseAutofind(emptyFixture);
    if (res.length !== 0) throw new Error('Expected 0 discovered ONUs for empty result');
  });

  // 5. Optical info parsing test
  runTest('HuaweiParser: parseOpticalInfo parses dBm readings and voltages accurately', () => {
    const fixture = `
  -----------------------------------------------------------------------------
   ONT optical information
  -----------------------------------------------------------------------------
   ONU NNI port ID                        : 0
   Module type                            : GPON
   Module sub-type                        : Class B+
   Used type                              : ONU
   Rx optical power(dBm)                  : -21.45
   Rx power min(dBm)                      : -27.00
   Rx power max(dBm)                      : -8.00
   Tx optical power(dBm)                  : 2.30
   Tx power min(dBm)                      : 0.50
   Tx power max(dBm)                      : 5.00
   Laser bias current(mA)                 : 15.2
   Temperature(C)                         : 38
   Supply Voltage(V)                      : 3.28
   OLT Rx ONT optical power(dBm)          : -22.10
  -----------------------------------------------------------------------------
    `;

    const opt = huaweiParser.parseOpticalInfo(fixture);
    if (!opt.isAvailable) throw new Error('Expected optical info to be available');
    if (opt.rxPower !== -21.45) throw new Error(`Expected Rx -21.45, got ${opt.rxPower}`);
    if (opt.txPower !== 2.30) throw new Error(`Expected Tx 2.30, got ${opt.txPower}`);
    if (opt.oltRxPower !== -22.10) throw new Error(`Expected OLT Rx -22.10, got ${opt.oltRxPower}`);
    if (opt.temperature !== 38 || opt.voltage !== 3.28 || opt.biasCurrent !== 15.2) {
      throw new Error('Temperature/voltage/bias mismatch');
    }
  });

  // 6. Assigned ONT ID extraction
  runTest('HuaweiParser: parseAssignedOntId extracts actual allocated ONT ID correctly', () => {
    const msg1 = 'Add ONT successfully, ONT ID is 7';
    if (huaweiParser.parseAssignedOntId(msg1) !== 7) throw new Error('Failed to parse "ONT ID is 7"');

    const msg2 = 'Notice: The ONT is being added...\nONT-ID: 14';
    if (huaweiParser.parseAssignedOntId(msg2) !== 14) throw new Error('Failed to parse "ONT-ID: 14"');
  });

  // 7. Service port parser
  runTest('HuaweiParser: parseServicePorts parses service-port lines', () => {
    const fixture = `
  -----------------------------------------------------------------------------
   INDEX VLAN  VLAN  PORT  F/ S/ P  ONT  GEM  USER-  TAG-MODE   STATE
         ID    ATTR  TYPE           ID   PORT VLAN
  -----------------------------------------------------------------------------
   152   738   com   gpon  0/ 0/ 0  3    10   738    translate  up
  -----------------------------------------------------------------------------
    `;
    const ports = huaweiParser.parseServicePorts(fixture);
    if (ports.length !== 1) throw new Error(`Expected 1 service port, got ${ports.length}`);
    const sp = ports[0];
    if (sp.index !== 152 || sp.vlanId !== 738 || sp.ontId !== 3 || sp.gemPort !== 10) {
      throw new Error('Service port attributes mismatch');
    }
  });

  // 8. Error detection
  runTest('HuaweiParser: detectCliError detects CLI errors accurately', () => {
    const errText = 'Failure: The ONT already exists';
    const err = huaweiParser.detectCliError(errText);
    if (!err || !err.includes('ONT already exists')) throw new Error('Failed to detect error');

    const okText = 'Add ONT successfully, ONT ID is 3';
    if (huaweiParser.detectCliError(okText) !== null) throw new Error('False positive error detected');
  });

  // 9. Credential encryption & decryption
  runTest('Crypto: Encrypts and decrypts OLT passwords securely with AES-256-GCM', () => {
    const plain = 'Huawei@Secret_99#';
    const encrypted = encryptSecret(plain);
    if (!encrypted.startsWith('aes256gcm:')) throw new Error('Ciphertext does not have aes256gcm prefix');
    const decrypted = decryptSecret(encrypted);
    if (decrypted !== plain) throw new Error('Decrypted password does not match original');
    if (maskSecret(plain) !== '••••••••') throw new Error('Masked secret mismatch');
  });

  // 10. Sanitizer
  runTest('Crypto: sanitizeLogOutput scrubs passwords and secrets', () => {
    const secret = 'MySuperPass123';
    const cmd = `ont add 0 sn-auth 485754435F9E5B9E password ${secret} desc test`;
    const sanitized = sanitizeLogOutput(cmd, [secret]);
    if (sanitized.includes(secret)) throw new Error('Sanitized output still contains secret');
    if (!sanitized.includes('[REDACTED]')) throw new Error('Sanitized output missing [REDACTED]');
  });

  return tests;
}
