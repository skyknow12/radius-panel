import http from 'node:http';
import fs from 'node:fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config/env';
import { RadiusClient, RadiusCode } from '../radius/radius-client';
import { logger } from '../lib/logger';

const execAsync = promisify(exec);

export interface RadiusRestartResult {
  success: boolean;
  message: string;
  method: 'docker_socket' | 'docker_cli' | 'systemctl' | 'verified_probe' | 'failed';
  restartedAt: string;
  containerName?: string;
  health: {
    status: 'healthy' | 'warning' | 'offline';
    latencyMs: number | null;
    authPort: number;
    acctPort: number;
    message: string;
  };
}

class RadiusManagementService {
  private radiusClient: RadiusClient;

  constructor() {
    this.radiusClient = new RadiusClient({
      host: config.RADIUS_HOST,
      secret: config.RADIUS_SECRET,
      timeoutMs: config.RADIUS_TIMEOUT_MS || 2500,
      retries: 1,
    });
  }

  /**
   * Send HTTP request to Docker Engine daemon over UNIX socket /var/run/docker.sock
   */
  private callDockerSocket(
    path: string,
    method: 'GET' | 'POST' = 'POST'
  ): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          socketPath: '/var/run/docker.sock',
          path,
          method,
          headers: {
            Host: 'localhost',
          },
          timeout: 15000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({ status: res.statusCode || 500, body: data });
          });
        }
      );

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Docker socket request timed out after 15s'));
      });
      req.end();
    });
  }

  /**
   * Restart FreeRADIUS daemon or container with multi-tiered fallback and liveliness verification
   */
  async restartRadius(): Promise<RadiusRestartResult> {
    const startedAt = new Date().toISOString();
    let method: RadiusRestartResult['method'] = 'failed';
    let restartError: string | null = null;
    let targetContainer = 'radius-freeradius';

    // Tier 1: Direct Docker Engine API via UNIX domain socket
    if (fs.existsSync('/var/run/docker.sock')) {
      try {
        logger.info('Attempting FreeRADIUS restart via Docker socket (/var/run/docker.sock)...');
        let resp = await this.callDockerSocket(
          `/v1.41/containers/${encodeURIComponent(targetContainer)}/restart?t=5`,
          'POST'
        );

        if (resp.status === 404) {
          // If exact name radius-freeradius not matched, query running containers
          try {
            const listResp = await this.callDockerSocket('/v1.41/containers/json?all=1', 'GET');
            if (listResp.status === 200) {
              const containers = JSON.parse(listResp.body);
              const matched = containers.find((c: any) =>
                c.Names?.some((n: string) => n.includes('freeradius')) ||
                c.Labels?.['com.docker.compose.service'] === 'freeradius'
              );
              if (matched && matched.Id) {
                targetContainer = matched.Names?.[0]?.replace(/^\//, '') || matched.Id;
                resp = await this.callDockerSocket(
                  `/v1.41/containers/${encodeURIComponent(matched.Id)}/restart?t=5`,
                  'POST'
                );
              }
            }
          } catch {
            // list parse failed
          }
        }

        if (resp.status >= 200 && resp.status < 300) {
          method = 'docker_socket';
          logger.info({ targetContainer }, 'FreeRADIUS container restarted successfully via Docker socket');
        } else {
          restartError = `Docker API returned HTTP ${resp.status}: ${resp.body}`;
          logger.warn({ targetContainer, resp }, 'Docker socket restart returned non-2xx status');
        }
      } catch (err: any) {
        restartError = err.message;
        logger.warn({ err: err.message }, 'Docker socket restart error, trying CLI fallback');
      }
    }

    // Tier 2: Host CLI fallback (docker command)
    if (method === 'failed') {
      try {
        await execAsync('docker restart radius-freeradius');
        method = 'docker_cli';
        logger.info('FreeRADIUS restarted via docker CLI command');
      } catch (cliErr: any) {
        // Tier 3: Systemd / init script fallback
        try {
          await execAsync('systemctl restart freeradius || service freeradius restart');
          method = 'systemctl';
          logger.info('FreeRADIUS restarted via systemctl/service command');
        } catch {
          // Continue to verification probe
        }
      }
    }

    // Grace period for FreeRADIUS process initialization and UDP port binding
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Tier 4: Verification probe & health confirmation
    let healthStatus: 'healthy' | 'warning' | 'offline' = 'offline';
    let latency: number | null = null;
    let message = '';

    try {
      const probe = await this.radiusClient.statusServer(config.RADIUS_AUTH_PORT);
      healthStatus = 'healthy';
      latency = probe.latencyMs;
      message = `FreeRADIUS daemon responsive on UDP ${config.RADIUS_AUTH_PORT} (${probe.codeName})`;
    } catch (probeErr: any) {
      try {
        const auth = await this.radiusClient.accessRequest(
          config.RADIUS_AUTH_PORT,
          config.RADIUS_HEALTHCHECK_USERNAME,
          config.RADIUS_HEALTHCHECK_PASSWORD,
          'radius-pro-restart-probe'
        );
        healthStatus = auth.code === RadiusCode.AccessAccept ? 'healthy' : 'warning';
        latency = auth.latencyMs;
        message = `Auth probe: ${auth.codeName} (${auth.latencyMs}ms)`;
      } catch (authErr: any) {
        healthStatus = 'offline';
        message = `FreeRADIUS daemon probe failed: ${authErr.message}`;
      }
    }

    if (method === 'failed' && (healthStatus === 'healthy' || healthStatus === 'warning')) {
      method = 'verified_probe';
    }

    const success = healthStatus === 'healthy' || healthStatus === 'warning' || method !== 'failed';

    return {
      success,
      message: success
        ? (method === 'docker_socket' || method === 'docker_cli'
          ? `FreeRADIUS container (${targetContainer}) restarted successfully. Server is ${healthStatus.toUpperCase()}.`
          : `FreeRADIUS operational status verified. Server is ${healthStatus.toUpperCase()}.`)
        : `FreeRADIUS restart error: ${restartError || message}`,
      method,
      restartedAt: startedAt,
      containerName: targetContainer,
      health: {
        status: healthStatus,
        latencyMs: latency,
        authPort: config.RADIUS_AUTH_PORT,
        acctPort: config.RADIUS_ACCT_PORT,
        message,
      },
    };
  }
}

export const radiusManagementService = new RadiusManagementService();
