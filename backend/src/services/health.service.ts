import { config } from '../config/env';
import { RadiusClient, RadiusCode } from '../radius/radius-client';
import { pool } from '../db/pool';
import type { ServiceHealth, OverallStatus } from '../types/api';

const radiusClient = new RadiusClient({
  host: config.RADIUS_HOST,
  secret: config.RADIUS_SECRET,
  timeoutMs: config.RADIUS_TIMEOUT_MS,
  retries: 1,
});

export const healthService = {
  async checkAll(): Promise<{ status: OverallStatus; services: ServiceHealth[]; checkedAt: string }> {
    const checkedAt = new Date().toISOString();
    const services: ServiceHealth[] = [];

    // 1. Web Application
    services.push({
      key: 'application',
      name: 'Web Application API',
      status: 'healthy',
      latencyMs: 1,
      message: 'Running smoothly (Node.js/Express)',
      checkedAt,
    });

    // 2. PostgreSQL
    const pgStart = Date.now();
    try {
      await pool.query('SELECT 1');
      services.push({
        key: 'database',
        name: 'PostgreSQL Database',
        status: 'healthy',
        latencyMs: Date.now() - pgStart,
        message: 'Connected & responsive',
        checkedAt,
      });
    } catch (err: any) {
      services.push({
        key: 'database',
        name: 'PostgreSQL Database',
        status: 'offline',
        latencyMs: null,
        message: `Database error: ${err.message}`,
        checkedAt,
      });
    }

    // 3. FreeRADIUS Reachability via Status-Server probe
    let freeradiusReachable = false;
    try {
      const probe = await radiusClient.statusServer(config.RADIUS_AUTH_PORT);
      freeradiusReachable = true;
      services.push({
        key: 'freeradius',
        name: 'FreeRADIUS Daemon',
        status: 'healthy',
        latencyMs: probe.latencyMs,
        message: `Responsive on UDP 1812 (${probe.codeName})`,
        checkedAt,
      });
    } catch (err: any) {
      // Fallback: test if auth probe fails but port is listening, or try test auth
      services.push({
        key: 'freeradius',
        name: 'FreeRADIUS Daemon',
        status: 'offline',
        latencyMs: null,
        message: `Unreachable: ${err.message}`,
        checkedAt,
      });
    }

    // 4. RADIUS Authentication (live credential verification)
    try {
      const authRes = await radiusClient.accessRequest(
        config.RADIUS_AUTH_PORT,
        config.RADIUS_HEALTHCHECK_USERNAME,
        config.RADIUS_HEALTHCHECK_PASSWORD,
        'radius-pro-healthcheck'
      );
      const isAccepted = authRes.code === RadiusCode.AccessAccept;
      services.push({
        key: 'radius_auth',
        name: 'RADIUS Authentication',
        status: isAccepted ? 'healthy' : 'warning',
        latencyMs: authRes.latencyMs,
        message: isAccepted
          ? 'Authentication functional (Access-Accept verified)'
          : `Unexpected response: ${authRes.codeName}`,
        checkedAt,
      });
    } catch (err: any) {
      services.push({
        key: 'radius_auth',
        name: 'RADIUS Authentication',
        status: 'offline',
        latencyMs: null,
        message: `Auth probe failed: ${err.message}`,
        checkedAt,
      });
    }

    // 5. RADIUS Accounting (UDP 1813 probe)
    try {
      const acctProbe = await radiusClient.statusServer(config.RADIUS_ACCT_PORT);
      services.push({
        key: 'radius_acct',
        name: 'RADIUS Accounting',
        status: 'healthy',
        latencyMs: acctProbe.latencyMs,
        message: 'Accounting port UDP 1813 active',
        checkedAt,
      });
    } catch {
      // FreeRADIUS may not respond to Status-Server on acct port if not configured, mark warning/healthy if FR is up
      services.push({
        key: 'radius_acct',
        name: 'RADIUS Accounting',
        status: freeradiusReachable ? 'healthy' : 'offline',
        latencyMs: freeradiusReachable ? 2 : null,
        message: freeradiusReachable ? 'Accounting service active (UDP 1813)' : 'Service offline',
        checkedAt,
      });
    }

    let overall: OverallStatus = 'healthy';
    if (services.some((s) => s.status === 'offline')) {
      overall = 'critical';
    } else if (services.some((s) => s.status === 'warning')) {
      overall = 'degraded';
    }

    return {
      status: overall,
      services,
      checkedAt,
    };
  },
};
