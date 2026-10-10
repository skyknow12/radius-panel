import { query } from '../db/pool';
import { RadiusClient, RadiusAttribute, RadiusAttr, encodeVsa } from '../radius/radius-client';
import { logger } from '../lib/logger';
import { config } from '../config/env';

export interface CoaResult {
  status: 'SUCCESS' | 'FAILED' | 'NOT SUPPORTED' | 'TIMEOUT';
  vendor: string;
  details: string;
}

export interface DisconnectSessionInput {
  username: string;
  sessionId?: string;
  nasIp?: string;
  framedIp?: string;
  operatorUsername?: string;
}

export interface ChangeSpeedInput {
  username: string;
  rateLimit: string;
  sessionId?: string;
  nasIp?: string;
  framedIp?: string;
  operatorUsername?: string;
  ingressPolicy?: string;
  egressPolicy?: string;
  activateService?: string;
  cosShapingRate?: string;
}

export const coaService = {
  async disconnectSession(input: DisconnectSessionInput): Promise<CoaResult> {
    const { username, sessionId, nasIp, framedIp, operatorUsername = 'admin' } = input;
    const vendor = await this.detectVendor(nasIp);

    logger.info({ username, sessionId, nasIp, vendor }, 'Executing vendor-aware disconnect request');

    let status: CoaResult['status'] = 'SUCCESS';
    let details = 'Session disconnect packet dispatched successfully';

    try {
      if (!nasIp) {
        status = 'NOT SUPPORTED';
        details = 'No active NAS IP recorded for session';
      } else {
        // Query NAS secret and check if NAS is configured
        const { rows: nasRows } = await query<{ secret: string; coa_port: number; is_test_nas: boolean }>(
          `SELECT secret, coa_port, is_test_nas FROM nas_devices WHERE host(ip_address) = $1 LIMIT 1`,
          [nasIp],
        );
        const secret = nasRows[0]?.secret || config.RADIUS_SECRET;
        const port = nasRows[0]?.coa_port || 3799;

        // Dispatch RFC 3576 Disconnect-Request
        const client = new RadiusClient({ host: nasIp, secret, timeoutMs: 2500 });
        const res = await client.disconnectRequest(port, username, sessionId, framedIp);

        if (res.codeName === 'Disconnect-ACK') {
          status = 'SUCCESS';
          details = `Received Disconnect-ACK from ${vendor} NAS (${nasIp}:${port})`;
        } else if (res.codeName === 'Disconnect-NAK') {
          status = 'FAILED';
          details = `Received Disconnect-NAK from ${vendor} NAS (${nasIp}:${port})`;
        }
      }
    } catch (err: any) {
      if (err.message?.includes('timeout') || err.message?.includes('ETIMEDOUT')) {
        status = 'TIMEOUT';
        details = `NAS ${nasIp} timed out waiting for Disconnect-ACK (Port 3799 unreachable)`;
      } else {
        status = 'FAILED';
        details = err.message || 'Disconnect request failed';
      }
    }

    // Record action in session_actions
    await query(
      `INSERT INTO session_actions (username, session_id, nas_ip, action, vendor, status, details, operator_username)
       VALUES ($1, $2, $3::inet, 'disconnect', $4, $5, $6, $7)`,
      [username, sessionId || null, nasIp || null, vendor, status, details, operatorUsername],
    );

    // Record event in network_events
    await query(
      `INSERT INTO network_events (event_type, severity, actor, target, description, metadata)
       VALUES ('session.disconnect', $1, $2, $3, $4, $5)`,
      [
        status === 'SUCCESS' ? 'info' : 'warning',
        operatorUsername,
        username,
        `Disconnect session for ${username} on ${nasIp || 'unknown'}: ${status}`,
        JSON.stringify({ sessionId, nasIp, vendor, status, details }),
      ],
    );

    return { status, vendor, details };
  },

  async changeSessionSpeed(input: ChangeSpeedInput): Promise<CoaResult> {
    const { username, rateLimit, sessionId, nasIp, framedIp, operatorUsername = 'admin' } = input;
    const vendor = await this.detectVendor(nasIp);

    logger.info({ username, rateLimit, nasIp, vendor }, 'Executing vendor-aware CoA speed change');

    let status: CoaResult['status'] = 'SUCCESS';
    let details = `CoA rate-limit update sent (${rateLimit})`;

    try {
      if (!nasIp) {
        status = 'NOT SUPPORTED';
        details = 'No active NAS IP recorded for session';
      } else {
        const { rows: nasRows } = await query<{ secret: string; coa_port: number }>(
          `SELECT secret, coa_port FROM nas_devices WHERE host(ip_address) = $1 LIMIT 1`,
          [nasIp],
        );
        const secret = nasRows[0]?.secret || config.RADIUS_SECRET;
        const port = nasRows[0]?.coa_port || 3799;

        // Build vendor-specific CoA attributes
        const attributes: RadiusAttribute[] = [
          { type: RadiusAttr.UserName, value: Buffer.from(username, 'utf8') },
        ];
        if (sessionId) attributes.push({ type: RadiusAttr.AcctSessionId, value: Buffer.from(sessionId, 'utf8') });
        if (framedIp) {
          const parts = framedIp.split('.').map((p) => parseInt(p, 10));
          if (parts.length === 4) {
            attributes.push({ type: RadiusAttr.FramedIpAddress, value: Buffer.from(parts) });
          }
        }

        if (vendor === 'MikroTik') {
          attributes.push(encodeVsa(14988, 8, rateLimit));
        } else if (vendor === 'Juniper') {
          // Juniper BNG Dynamic Profile rate-limit via firewall filter or dynamic service
          const inPolicy = input.ingressPolicy || (rateLimit.includes('/') ? `BW-${rateLimit.split('/')[0]}-IN` : `BW-${rateLimit}-IN`);
          const outPolicy = input.egressPolicy || (rateLimit.includes('/') ? `BW-${rateLimit.split('/')[1]}-OUT` : `BW-${rateLimit}-OUT`);
          attributes.push(encodeVsa(2636, 10, inPolicy)); // Juniper-Ingress-Policy-Name (VSA 10)
          attributes.push(encodeVsa(2636, 11, outPolicy)); // Juniper-Egress-Policy-Name (VSA 11)

          if (input.activateService) {
            attributes.push(encodeVsa(2636, 65, input.activateService)); // Juniper-Activate-Service (VSA 65)
          }
          if (input.cosShapingRate) {
            attributes.push(encodeVsa(2636, 177, input.cosShapingRate)); // Juniper-Cos-Shaping-Rate (VSA 177)
          }
        } else {
          attributes.push({ type: RadiusAttr.ReplyMessage, value: Buffer.from(rateLimit, 'utf8') });
        }

        const client = new RadiusClient({ host: nasIp, secret, timeoutMs: 2500 });
        const res = await client.coaRequest(port, attributes);

        if (res.codeName === 'CoA-ACK') {
          status = 'SUCCESS';
          details = vendor === 'Juniper'
            ? `Received CoA-ACK from Juniper BNG: filters updated (Ingress/Egress)`
            : `Received CoA-ACK from ${vendor} NAS: rate limit set to ${rateLimit}`;
        } else if (res.codeName === 'CoA-NAK') {
          status = 'FAILED';
          details = `Received CoA-NAK from ${vendor} NAS (${nasIp}:${port})`;
        }
      }
    } catch (err: any) {
      if (err.message?.includes('timeout') || err.message?.includes('ETIMEDOUT')) {
        status = 'TIMEOUT';
        details = `NAS ${nasIp} timed out waiting for CoA-ACK (Port 3799 unreachable)`;
      } else {
        status = 'FAILED';
        details = err.message || 'CoA rate limit request failed';
      }
    }

    // Record action in session_actions
    await query(
      `INSERT INTO session_actions (username, session_id, nas_ip, action, vendor, status, details, operator_username)
       VALUES ($1, $2, $3::inet, 'coa_rate_limit', $4, $5, $6, $7)`,
      [username, sessionId || null, nasIp || null, vendor, status, details, operatorUsername],
    );

    return { status, vendor, details };
  },

  async detectVendor(nasIp?: string): Promise<string> {
    if (!nasIp) return 'Generic';
    const { rows } = await query<{ vendor: string; nas_type: string }>(
      `SELECT vendor, nas_type FROM nas_devices WHERE host(ip_address) = $1 LIMIT 1`,
      [nasIp],
    );
    const row = rows[0];
    if (row?.vendor) {
      if (/juniper/i.test(row.vendor)) return 'Juniper';
      if (/mikrotik/i.test(row.vendor)) return 'MikroTik';
      if (/cisco/i.test(row.vendor)) return 'Cisco';
      if (/huawei/i.test(row.vendor)) return 'Huawei';
      if (/generic/i.test(row.vendor)) return 'Generic';
    }
    if (row?.nas_type) {
      if (/juniper/i.test(row.nas_type)) return 'Juniper';
      if (/mikrotik/i.test(row.nas_type)) return 'MikroTik';
      if (/cisco/i.test(row.nas_type)) return 'Cisco';
      if (/huawei/i.test(row.nas_type)) return 'Huawei';
    }
    return row?.vendor || 'Generic';
  },
};
