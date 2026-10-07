import { query } from '../db/pool';
import { RadiusClient } from '../radius/client';
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

        // Build vendor attributes
        const attributes: { attribute: string; value: string }[] = [
          { attribute: 'User-Name', value: username },
        ];
        if (sessionId) attributes.push({ attribute: 'Acct-Session-Id', value: sessionId });
        if (framedIp) attributes.push({ attribute: 'Framed-IP-Address', value: framedIp });

        // Dispatch RFC 3576 Disconnect-Request
        const client = new RadiusClient({ host: nasIp, port, secret, timeoutMs: 2500 });
        const res = await client.disconnect(attributes);

        if (res.code === 'Disconnect-ACK') {
          status = 'SUCCESS';
          details = `Received Disconnect-ACK from ${vendor} NAS (${nasIp}:${port})`;
        } else if (res.code === 'Disconnect-NAK') {
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
        const attributes: { attribute: string; value: string }[] = [
          { attribute: 'User-Name', value: username },
        ];
        if (sessionId) attributes.push({ attribute: 'Acct-Session-Id', value: sessionId });
        if (framedIp) attributes.push({ attribute: 'Framed-IP-Address', value: framedIp });

        if (vendor === 'MikroTik') {
          attributes.push({ attribute: 'Mikrotik-Rate-Limit', value: rateLimit });
        } else if (vendor === 'Cisco') {
          attributes.push({ attribute: 'Cisco-AVPair', value: `subscriber:sub-qos-policy-out=${rateLimit}` });
        } else if (vendor === 'Juniper') {
          attributes.push({ attribute: 'ERX-Service-Activate', value: `Rate-Limit(${rateLimit})` });
        } else {
          attributes.push({ attribute: 'Filter-Id', value: rateLimit });
        }

        const client = new RadiusClient({ host: nasIp, port, secret, timeoutMs: 2500 });
        const res = await client.coa(attributes);

        if (res.code === 'CoA-ACK') {
          status = 'SUCCESS';
          details = `Received CoA-ACK from ${vendor} NAS: rate limit set to ${rateLimit}`;
        } else if (res.code === 'CoA-NAK') {
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
    if (rows[0]?.nas_type) {
      if (/mikrotik/i.test(rows[0].nas_type)) return 'MikroTik';
      if (/juniper/i.test(rows[0].nas_type)) return 'Juniper';
      if (/cisco/i.test(rows[0].nas_type)) return 'Cisco';
    }
    return rows[0]?.vendor || 'Generic';
  },
};
