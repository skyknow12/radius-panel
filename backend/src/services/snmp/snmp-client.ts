import dgram from 'node:dgram';
import net from 'node:net';
import crypto from 'node:crypto';
import { ASN1_TAGS, buildSnmpPacket, parseSnmpResponse } from './ber';
import type { SnmpConfig, SnmpVarBind, SnmpVersion } from './types';

/**
 * SSRF Protection: Validates management host against prohibited targets
 */
export function validateManagementTarget(host: string, port = 161): void {
  const trimmed = host.trim().toLowerCase();

  if (!trimmed) {
    throw new Error('Management target host is required');
  }

  if (port < 1 || port > 65535) {
    throw new Error(`Invalid SNMP port: ${port}. Must be between 1 and 65535.`);
  }

  // Block localhost and standard aliases
  if (trimmed === 'localhost' || trimmed === '127.0.0.1' || trimmed === '::1') {
    throw new Error('Access denied: Localhost and loopback addresses cannot be targeted');
  }

  // Block cloud metadata services (AWS, GCP, Azure, DigitalOcean)
  if (trimmed.startsWith('169.254.') || trimmed === 'metadata.google.internal') {
    throw new Error('Access denied: Cloud metadata services cannot be targeted');
  }

  // Block zero/broadcast addresses
  if (trimmed === '0.0.0.0' || trimmed === '255.255.255.255') {
    throw new Error('Access denied: Unspecified or broadcast addresses cannot be targeted');
  }

  // If IP address, check specific CIDR blocks
  if (net.isIPv4(trimmed)) {
    const parts = trimmed.split('.').map(Number);
    // 127.0.0.0/8
    if (parts[0] === 127) {
      throw new Error('Access denied: Loopback IPv4 addresses cannot be targeted');
    }
    // 169.254.0.0/16
    if (parts[0] === 169 && parts[1] === 254) {
      throw new Error('Access denied: Link-local addresses cannot be targeted');
    }
    // 224.0.0.0/4 (Multicast)
    if (parts[0] >= 224 && parts[0] <= 239) {
      throw new Error('Access denied: Multicast addresses cannot be targeted');
    }
  }
}

/**
 * Native Node.js SNMP Client
 */
export class SnmpClient {
  private config: SnmpConfig;

  constructor(config: SnmpConfig) {
    validateManagementTarget(config.host, config.port || 161);
    this.config = {
      port: 161,
      timeoutMs: 3000,
      retries: 2,
      community: 'public',
      version: 'v2c',
      ...config,
    };
  }

  /**
   * Send a single SNMP request with retries and timeout
   */
  private async sendRequest(
    pduType: number,
    oids: string[],
    nonRepeaters = 0,
    maxRepetitions = 10
  ): Promise<{ varBinds: SnmpVarBind[]; rttMs: number }> {
    const versionNum = this.config.version === 'v1' ? 0 : 1;
    const community = this.config.community || 'public';
    const port = this.config.port || 161;
    const host = this.config.host;
    const timeoutMs = this.config.timeoutMs || 3000;
    const maxAttempts = (this.config.retries ?? 2) + 1;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const requestId = Math.floor(10000 + Math.random() * 89999);
      const packet = buildSnmpPacket(
        versionNum,
        community,
        pduType,
        requestId,
        oids,
        nonRepeaters,
        maxRepetitions
      );

      const startTime = Date.now();

      try {
        const respBuffer = await new Promise<Buffer>((resolve, reject) => {
          const socket = dgram.createSocket(net.isIPv6(host) ? 'udp6' : 'udp4');
          let timer: NodeJS.Timeout | null = null;
          let settled = false;

          const cleanup = () => {
            if (timer) clearTimeout(timer);
            try {
              socket.close();
            } catch {}
          };

          socket.on('error', (err) => {
            if (!settled) {
              settled = true;
              cleanup();
              reject(err);
            }
          });

          socket.on('message', (msg) => {
            if (!settled) {
              settled = true;
              cleanup();
              resolve(msg);
            }
          });

          timer = setTimeout(() => {
            if (!settled) {
              settled = true;
              cleanup();
              reject(new Error(`SNMP request timed out after ${timeoutMs}ms (attempt ${attempt}/${maxAttempts})`));
            }
          }, timeoutMs);

          socket.send(packet, port, host, (err) => {
            if (err && !settled) {
              settled = true;
              cleanup();
              reject(err);
            }
          });
        });

        const rttMs = Date.now() - startTime;
        const parsed = parseSnmpResponse(respBuffer);

        if (parsed.requestId !== requestId) {
          throw new Error(`SNMP request ID mismatch: sent ${requestId}, got ${parsed.requestId}`);
        }

        if (parsed.errorStatus !== 0) {
          const errCodes: Record<number, string> = {
            1: 'tooBig',
            2: 'noSuchName',
            3: 'badValue',
            4: 'readOnly',
            5: 'genErr',
            6: 'noAccess',
            7: 'wrongType',
            8: 'wrongLength',
            9: 'wrongEncoding',
            10: 'wrongValue',
            11: 'noCreation',
            12: 'inconsistentValue',
            13: 'resourceUnavailable',
            14: 'commitFailed',
            15: 'undoFailed',
            16: 'authorizationError',
            17: 'notWritable',
            18: 'inconsistentName',
          };
          const errDesc = errCodes[parsed.errorStatus] || `code ${parsed.errorStatus}`;
          throw new Error(`SNMP Agent Error: ${errDesc} at index ${parsed.errorIndex}`);
        }

        const varBinds: SnmpVarBind[] = parsed.varBinds.map((vb) => ({
          oid: vb.oid,
          type: vb.typeName,
          value: vb.value,
        }));

        return { varBinds, rttMs };
      } catch (err: any) {
        lastError = err;
        // Exponential backoff before retry
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, Math.min(1000 * attempt, 3000)));
        }
      }
    }

    throw lastError || new Error(`SNMP request failed after ${maxAttempts} attempts`);
  }

  /**
   * Perform an SNMP GET for one or more OIDs
   */
  async get(oids: string[]): Promise<SnmpVarBind[]> {
    if (oids.length === 0) return [];
    const { varBinds } = await this.sendRequest(ASN1_TAGS.GET_REQUEST, oids);
    return varBinds;
  }

  /**
   * Perform an SNMP GET-NEXT
   */
  async getNext(oid: string): Promise<SnmpVarBind | null> {
    const { varBinds } = await this.sendRequest(ASN1_TAGS.GET_NEXT_REQUEST, [oid]);
    return varBinds[0] || null;
  }

  /**
   * Perform an SNMP GET-BULK (v2c / v3)
   */
  async getBulk(oids: string[], nonRepeaters = 0, maxRepetitions = 20): Promise<SnmpVarBind[]> {
    if (this.config.version === 'v1') {
      return this.get(oids);
    }
    const { varBinds } = await this.sendRequest(
      ASN1_TAGS.GET_BULK_REQUEST,
      oids,
      nonRepeaters,
      maxRepetitions
    );
    return varBinds;
  }

  /**
   * Walk an entire subtree rooted at rootOid
   */
  async walk(rootOid: string, maxIterations = 500): Promise<SnmpVarBind[]> {
    const normalizedRoot = rootOid.startsWith('.') ? rootOid : '.' + rootOid;
    const results: SnmpVarBind[] = [];
    let currentOid = normalizedRoot;

    for (let i = 0; i < maxIterations; i++) {
      let nextVb: SnmpVarBind | null = null;
      try {
        nextVb = await this.getNext(currentOid);
      } catch (err: any) {
        // If device returns noSuchName or end of mib, terminate walk cleanly
        break;
      }

      if (!nextVb) break;
      if (nextVb.type === 'EndOfMibView' || nextVb.type === 'NoSuchObject' || nextVb.type === 'NoSuchInstance') {
        break;
      }

      // Check if next OID is still inside the root subtree
      if (!nextVb.oid.startsWith(normalizedRoot + '.') && nextVb.oid !== normalizedRoot) {
        break;
      }

      // Guard against infinite loop
      if (nextVb.oid === currentOid) break;

      results.push(nextVb);
      currentOid = nextVb.oid;
    }

    return results;
  }

  /**
   * Test SNMP connectivity to target device
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    sysDescr?: string;
    sysUpTime?: string;
    rttMs?: number;
  }> {
    try {
      const { varBinds, rttMs } = await this.sendRequest(
        ASN1_TAGS.GET_REQUEST,
        ['.1.3.6.1.2.1.1.1.0', '.1.3.6.1.2.1.1.3.0'] // sysDescr, sysUpTime
      );

      const sysDescr = varBinds.find((v) => v.oid === '.1.3.6.1.2.1.1.1.0')?.value || '';
      const sysUpTimeTicks = varBinds.find((v) => v.oid === '.1.3.6.1.2.1.1.3.0')?.value;

      let upTimeStr = '';
      if (typeof sysUpTimeTicks === 'number') {
        const totalSeconds = Math.floor(sysUpTimeTicks / 100);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        upTimeStr = `${days}d ${hours}h ${mins}m`;
      }

      return {
        success: true,
        message: `SNMP ${this.config.version} responding (${rttMs}ms)`,
        sysDescr: String(sysDescr).slice(0, 200),
        sysUpTime: upTimeStr,
        rttMs,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'SNMP connection test failed',
      };
    }
  }
}
