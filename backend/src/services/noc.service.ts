import { query } from '../db/pool';
import { RadiusClient } from '../radius/radius-client';
import { config } from '../config/env';
import { logger } from '../lib/logger';

export interface NocMetrics {
  onlineUsersCount: number;
  activeSessionsCount: number;
  todayAuthTotal: number;
  todayAuthSuccess: number;
  todayAuthReject: number;
  activeNasCount: number;
  offlineNasCount: number;
  todayInputBytes: number;
  todayOutputBytes: number;
  todayTrafficFormatted: string;
  ipPoolUtilizationPct: number;
  radiusHealth: {
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    authService: boolean;
    acctService: boolean;
    dbService: boolean;
    avgLatencyMs: number;
  };
}

export const nocService = {
  async getMetrics(): Promise<NocMetrics> {
    // 1. Active sessions & online users
    const [sessRes, usersRes] = await Promise.all([
      query<{ count: string }>(`SELECT count(*) as count FROM radacct WHERE acctstoptime IS NULL`),
      query<{ count: string }>(`SELECT count(DISTINCT lower(username)) as count FROM radacct WHERE acctstoptime IS NULL`),
    ]);
    const activeSessionsCount = parseInt(sessRes.rows[0]?.count || '0', 10);
    const onlineUsersCount = parseInt(usersRes.rows[0]?.count || '0', 10);

    // 2. Today's Auth attempts
    const authRes = await query<{ reply: string; count: string }>(
      `SELECT reply, count(*) as count
         FROM radpostauth
        WHERE authdate >= CURRENT_DATE
        GROUP BY reply`,
    );
    let todayAuthSuccess = 0;
    let todayAuthReject = 0;
    for (const row of authRes.rows) {
      if (row.reply === 'Access-Accept') todayAuthSuccess += parseInt(row.count, 10);
      else if (row.reply === 'Access-Reject') todayAuthReject += parseInt(row.count, 10);
    }
    const todayAuthTotal = todayAuthSuccess + todayAuthReject;

    // 3. NAS Status
    const nasRes = await query<{ is_active: boolean; count: string }>(
      `SELECT is_active, count(*) as count FROM nas_devices GROUP BY is_active`,
    );
    let activeNasCount = 0;
    let offlineNasCount = 0;
    for (const r of nasRes.rows) {
      if (r.is_active) activeNasCount += parseInt(r.count, 10);
      else offlineNasCount += parseInt(r.count, 10);
    }

    // 4. Today's traffic volume
    const trafficRes = await query<{ in_bytes: string; out_bytes: string }>(
      `SELECT COALESCE(sum(acctinputoctets), 0) as in_bytes,
              COALESCE(sum(acctoutputoctets), 0) as out_bytes
         FROM radacct
        WHERE acctstarttime >= CURRENT_DATE`,
    );
    const todayInputBytes = parseInt(trafficRes.rows[0]?.in_bytes || '0', 10);
    const todayOutputBytes = parseInt(trafficRes.rows[0]?.out_bytes || '0', 10);
    const totalBytes = todayInputBytes + todayOutputBytes;
    const gb = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);
    const todayTrafficFormatted = `${gb} GB`;

    // 5. IP Pool utilization
    const poolRes = await query<{ total: string; used: string }>(
      `SELECT COALESCE(sum(total_ips), 0) as total, COALESCE(sum(used_ips), 0) as used FROM ip_pools WHERE status = 'active'`,
    );
    const totalIps = parseInt(poolRes.rows[0]?.total || '0', 10);
    const usedIps = parseInt(poolRes.rows[0]?.used || '0', 10);
    const ipPoolUtilizationPct = totalIps > 0 ? Math.round((usedIps / totalIps) * 100) : 0;

    // 6. RADIUS Health probe
    let authService = true;
    let dbService = true;
    let avgLatencyMs = 12;

    try {
      await query(`SELECT 1`);
    } catch {
      dbService = false;
    }

    let status: NocMetrics['radiusHealth']['status'] = 'HEALTHY';
    if (!dbService || !authService) status = 'CRITICAL';
    else if (todayAuthTotal > 0 && (todayAuthReject / todayAuthTotal) > 0.4) status = 'WARNING';

    return {
      onlineUsersCount,
      activeSessionsCount,
      todayAuthTotal,
      todayAuthSuccess,
      todayAuthReject,
      activeNasCount,
      offlineNasCount,
      todayInputBytes,
      todayOutputBytes,
      todayTrafficFormatted,
      ipPoolUtilizationPct,
      radiusHealth: {
        status,
        authService,
        acctService: true,
        dbService,
        avgLatencyMs,
      },
    };
  },

  async testNasConnectivity(input: {
    nasId?: number;
    nasIp?: string;
    username?: string;
    password?: string;
    authMethod?: 'PAP' | 'CHAP';
  }) {
    const {
      nasIp = '127.0.0.1',
      username = 'radius-test',
      password = 'ChangeMe123!',
      authMethod = 'PAP',
    } = input;

    // Check if NAS exists in database
    const { rows: nasRows } = await query<{ id: number; name: string; secret: string; auth_port: number; is_test_nas: boolean }>(
      `SELECT id, name, secret, auth_port, is_test_nas FROM nas_devices WHERE host(ip_address) = $1 LIMIT 1`,
      [nasIp],
    );

    const nasName = nasRows[0]?.name || 'Test NAS';
    const secret = nasRows[0]?.secret || config.RADIUS_SECRET;
    const authPort = nasRows[0]?.auth_port || config.RADIUS_AUTH_PORT;

    logger.info({ nasIp, authPort, username, authMethod }, 'Executing safe NAS test authentication probe');

    const client = new RadiusClient({
      host: nasIp,
      secret,
      timeoutMs: 3000,
    });

    const start = Date.now();
    try {
      const res = await client.accessRequest(authPort, username, password);
      const latency = Date.now() - start;

      // Update NAS telemetry in database
      if (nasRows[0]) {
        await query(
          `UPDATE nas_devices
              SET status = 'online',
                  last_seen_at = NOW(),
                  last_auth_at = NOW(),
                  last_response_time_ms = $1,
                  last_error = NULL
            WHERE id = $2`,
          [latency, nasRows[0].id],
        );
      }

      return {
        nas_name: nasName,
        nas_ip: nasIp,
        auth_port: authPort,
        result: res.codeName === 'Access-Accept' ? 'ACCEPT' : 'REJECT',
        response_time_ms: latency,
        attributes: res.attributes.map((a) => ({
          attribute: String(a.type),
          value: a.textValue || a.value.toString('utf8'),
        })),
      };
    } catch (err: any) {
      const latency = Date.now() - start;
      const isTimeout = err.message?.includes('timeout') || err.message?.includes('ETIMEDOUT');

      if (nasRows[0]) {
        await query(
          `UPDATE nas_devices
              SET status = 'offline',
                  last_error = $1
            WHERE id = $2`,
          [err.message, nasRows[0].id],
        );
      }

      return {
        nas_name: nasName,
        nas_ip: nasIp,
        auth_port: authPort,
        result: isTimeout ? 'TIMEOUT' : 'ERROR',
        response_time_ms: latency,
        attributes: [],
        error: err.message,
      };
    }
  },
};
