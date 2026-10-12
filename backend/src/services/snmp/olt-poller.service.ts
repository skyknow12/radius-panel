import { query } from '../../db/pool';
import { SnmpClient } from './snmp-client';
import { collectSystemInfo, collectInterfaces } from './standard-mib';
import { getVendorAdapter } from './adapter-factory';
import { decryptSecret } from '../../lib/crypto';
import type {
  HardwareHealth,
  InterfaceTelemetry,
  OltAlarm,
  OltNormalizedTelemetry,
  OltVendor,
  OnuOpticalTelemetry,
  SnmpConfig,
  SystemInfo,
} from './types';

// In-memory mutex per OLT ID
const activePolls = new Set<number>();

// In-memory cache of previous interface counter timestamps: oltId -> Map(ifIndex -> { inOctets, outOctets, timestamp })
const interfaceCounterCache = new Map<
  number,
  Map<number, { inOctets: number; outOctets: number; timestamp: number }>
>();

// In-memory cache of last normalized telemetry per OLT
const lastTelemetryCache = new Map<number, OltNormalizedTelemetry>();

// Concurrency limiter configuration
const MAX_CONCURRENT_POLLS = 5;
let runningPollCount = 0;
const pollQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (runningPollCount < MAX_CONCURRENT_POLLS) {
    runningPollCount++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    pollQueue.push(() => {
      runningPollCount++;
      resolve();
    });
  });
}

function releaseSlot(): void {
  runningPollCount--;
  if (pollQueue.length > 0) {
    const next = pollQueue.shift();
    if (next) next();
  }
}

export class OltPollerService {
  private schedulerTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start scheduled background poller
   */
  startScheduler(intervalMs = 30000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.schedulerTimer = setInterval(() => {
      this.pollScheduledOlts().catch((err) => {
        console.error('[OLT Poller] Scheduled tick error:', err.message);
      });
    }, intervalMs);
    // Don't keep Node process alive solely for background timer
    this.schedulerTimer.unref();
  }

  /**
   * Stop scheduled background poller
   */
  stopScheduler(): void {
    this.isRunning = false;
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  /**
   * Check which OLTs are due for polling
   */
  async pollScheduledOlts(): Promise<void> {
    try {
      const sql = `
        SELECT id, name, polling_interval, last_poll_at
          FROM olts
         WHERE enabled = TRUE
           AND (snmp_enabled IS NULL OR snmp_enabled = TRUE)
           AND (
             last_poll_at IS NULL
             OR last_poll_at + (COALESCE(polling_interval, 300) || ' seconds')::interval <= NOW()
           )
         ORDER BY COALESCE(last_poll_at, '1970-01-01'::timestamptz) ASC
         LIMIT 10
      `;
      const { rows } = await query<{ id: number; name: string }>(sql);

      for (const row of rows) {
        if (!activePolls.has(row.id)) {
          // Poll asynchronously in background
          this.pollOlt(row.id).catch((err) => {
            console.warn(`[OLT Poller] Scheduled poll failed for OLT ${row.id} (${row.name}):`, err.message);
          });
        }
      }
    } catch (err: any) {
      console.error('[OLT Poller] Failed to query scheduled OLTs:', err.message);
    }
  }

  /**
   * Poll a single OLT by ID with per-device mutex lock and concurrency limit
   */
  async pollOlt(oltId: number, _options: { force?: boolean } = {}): Promise<OltNormalizedTelemetry> {
    if (activePolls.has(oltId)) {
      throw new Error(`SNMP poll already in progress for OLT #${oltId}`);
    }

    activePolls.add(oltId);
    await acquireSlot();

    const startTime = Date.now();

    try {
      // 1. Fetch OLT device record and decrypt SNMP credentials
      const { rows } = await query<any>(
        `SELECT id, name, vendor, model, host(management_ip) AS management_ip,
                snmp_version, snmp_port, snmp_community_encrypted, snmp_write_community_encrypted,
                snmp_timeout_ms, snmp_retries, polling_interval, enabled,
                sys_uptime, sys_descr, sys_name, sys_location, sys_contact,
                cpu_utilization, memory_utilization, temperature, fans_status, power_status,
                telemetry_data, last_poll_at, last_poll_status
           FROM olts
          WHERE id = $1`,
        [oltId]
      );

      if (!rows[0]) {
        throw new Error(`OLT with ID ${oltId} not found`);
      }

      const olt = rows[0];
      const vendor: OltVendor = olt.vendor || 'Huawei';
      const model = olt.model || 'MA5683T';
      const community = olt.snmp_community_encrypted ? decryptSecret(olt.snmp_community_encrypted) : 'public';

      const snmpConfig: SnmpConfig = {
        host: olt.management_ip,
        port: olt.snmp_port || 161,
        version: (olt.snmp_version || 'v2c') as any,
        community,
        timeoutMs: olt.snmp_timeout_ms || 3000,
        retries: olt.snmp_retries ?? 2,
      };

      const client = new SnmpClient(snmpConfig);
      const adapter = getVendorAdapter(vendor);

      // 2. Collect Standard MIB System info
      let system: SystemInfo | null = null;
      try {
        system = await collectSystemInfo(client);
      } catch (err: any) {
        console.warn(`[OLT Poller] Failed to collect system info for OLT ${oltId}: ${err.message}`);
      }

      // 3. Collect Interface telemetry with rate calculation
      const prevInterfaces = interfaceCounterCache.get(oltId);
      let interfaces: InterfaceTelemetry[] = [];
      try {
        interfaces = await collectInterfaces(client, prevInterfaces);
        // Cache new counter values for subsequent delta rate calculation
        const newCounterMap = new Map<number, { inOctets: number; outOctets: number; timestamp: number }>();
        const nowMs = Date.now();
        for (const iface of interfaces) {
          newCounterMap.set(iface.ifIndex, {
            inOctets: iface.inOctets,
            outOctets: iface.outOctets,
            timestamp: nowMs,
          });
        }
        interfaceCounterCache.set(oltId, newCounterMap);
      } catch (err: any) {
        console.warn(`[OLT Poller] Failed to collect interfaces for OLT ${oltId}: ${err.message}`);
      }

      // 4. Collect Vendor Health, ONUs, and Alarms
      let health: HardwareHealth;
      try {
        health = await adapter.collectHardwareHealth(client);
      } catch {
        health = {
          cpuUtilization: null,
          memoryUtilization: null,
          temperature: null,
          fansStatus: null,
          powerStatus: null,
          isCpuSupported: false,
          isMemorySupported: false,
          isTemperatureSupported: false,
          isFansSupported: false,
          isPowerSupported: false,
        };
      }

      let onus: OnuOpticalTelemetry[] = [];
      try {
        onus = await adapter.collectOnuTelemetry(client);
      } catch (err: any) {
        console.warn(`[OLT Poller] Failed to collect ONUs for OLT ${oltId}: ${err.message}`);
      }

      let alarms: OltAlarm[] = [];
      try {
        alarms = await adapter.collectAlarms(client);
      } catch (err: any) {
        console.warn(`[OLT Poller] Failed to collect alarms for OLT ${oltId}: ${err.message}`);
      }

      const pollDurationMs = Date.now() - startTime;
      const isReachable = system !== null || interfaces.length > 0 || onus.length > 0;

      const upInterfaces = interfaces.filter((i) => i.operStatus === 'up').length;
      const onlineOnus = onus.filter((o) => o.runState === 'online').length;

      const telemetry: OltNormalizedTelemetry = {
        oltId,
        timestamp: new Date().toISOString(),
        isReachable,
        isStale: false,
        staleSince: null,
        pollDurationMs,
        vendor,
        model,
        system,
        health,
        interfaces,
        onus,
        alarms,
        counts: {
          totalInterfaces: interfaces.length,
          upInterfaces,
          totalOnus: onus.length,
          onlineOnus,
          activeAlarms: alarms.length,
        },
        supportedOids: adapter.getSupportedOids(),
        error: null,
      };

      // 5. Persist to Database
      await this.saveTelemetryToDb(oltId, telemetry);

      // Cache telemetry
      lastTelemetryCache.set(oltId, telemetry);

      return telemetry;
    } catch (err: any) {
      const pollDurationMs = Date.now() - startTime;
      console.error(`[OLT Poller] Polling failed for OLT ${oltId}:`, err.message);

      // Handle Stale Data Tracking
      const existing = lastTelemetryCache.get(oltId);
      const staleTelemetry: OltNormalizedTelemetry = existing
        ? {
            ...existing,
            isReachable: false,
            isStale: true,
            staleSince: existing.staleSince || new Date().toISOString(),
            pollDurationMs,
            error: err.message,
          }
        : {
            oltId,
            timestamp: new Date().toISOString(),
            isReachable: false,
            isStale: true,
            staleSince: new Date().toISOString(),
            pollDurationMs,
            vendor: 'Other',
            model: 'Unknown',
            system: null,
            health: {
              cpuUtilization: null,
              memoryUtilization: null,
              temperature: null,
              fansStatus: null,
              powerStatus: null,
              isCpuSupported: false,
              isMemorySupported: false,
              isTemperatureSupported: false,
              isFansSupported: false,
              isPowerSupported: false,
            },
            interfaces: [],
            onus: [],
            alarms: [],
            counts: {
              totalInterfaces: 0,
              upInterfaces: 0,
              totalOnus: 0,
              onlineOnus: 0,
              activeAlarms: 0,
            },
            supportedOids: [],
            error: err.message,
          };

      lastTelemetryCache.set(oltId, staleTelemetry);

      // Update OLT state in database with error status
      const statusType = err.message?.toLowerCase().includes('time') ? 'timeout' : 'error';
      await query(
        `UPDATE olts
            SET last_poll_at = NOW(),
                last_poll_status = $2,
                last_poll_error = $3,
                connection_status = 'offline',
                updated_at = NOW()
          WHERE id = $1`,
        [oltId, statusType, err.message?.slice(0, 500) || 'SNMP polling failed']
      ).catch(() => {});

      throw err;
    } finally {
      releaseSlot();
      activePolls.delete(oltId);
    }
  }

  /**
   * Persist telemetry results to database
   */
  private async saveTelemetryToDb(oltId: number, telemetry: OltNormalizedTelemetry): Promise<void> {
    try {
      // 1. Update OLT summary
      await query(
        `UPDATE olts
            SET last_poll_at = NOW(),
                last_poll_status = 'success',
                last_poll_error = NULL,
                connection_status = 'online',
                last_seen_at = NOW(),
                sys_uptime = COALESCE($2, sys_uptime),
                sys_descr = COALESCE($3, sys_descr),
                sys_name = COALESCE($4, sys_name),
                sys_location = COALESCE($5, sys_location),
                sys_contact = COALESCE($6, sys_contact),
                cpu_utilization = $7,
                memory_utilization = $8,
                temperature = $9,
                fans_status = $10,
                power_status = $11,
                active_alarms_count = $12,
                registered_onus_count = $13,
                online_onus_count = $14,
                telemetry_data = $15,
                updated_at = NOW()
          WHERE id = $1`,
        [
          oltId,
          telemetry.system?.sysUpTime || null,
          telemetry.system?.sysDescr || null,
          telemetry.system?.sysName || null,
          telemetry.system?.sysLocation || null,
          telemetry.system?.sysContact || null,
          telemetry.health.cpuUtilization,
          telemetry.health.memoryUtilization,
          telemetry.health.temperature,
          telemetry.health.fansStatus,
          telemetry.health.powerStatus,
          telemetry.counts.activeAlarms,
          telemetry.counts.totalOnus,
          telemetry.counts.onlineOnus,
          JSON.stringify(telemetry),
        ]
      );

      // 2. Upsert Interfaces into olt_interfaces table
      if (telemetry.interfaces.length > 0) {
        for (const iface of telemetry.interfaces) {
          await query(
            `INSERT INTO olt_interfaces (
               olt_id, if_index, if_name, if_descr, if_type, admin_status, oper_status,
               speed_bps, mac_address, mtu, in_octets, out_octets, in_rate_bps, out_rate_bps,
               in_errors, out_errors, in_discards, out_discards, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
             ON CONFLICT (olt_id, if_index) DO UPDATE
             SET if_name = EXCLUDED.if_name,
                 if_descr = EXCLUDED.if_descr,
                 if_type = EXCLUDED.if_type,
                 admin_status = EXCLUDED.admin_status,
                 oper_status = EXCLUDED.oper_status,
                 speed_bps = EXCLUDED.speed_bps,
                 mac_address = EXCLUDED.mac_address,
                 mtu = EXCLUDED.mtu,
                 in_octets = EXCLUDED.in_octets,
                 out_octets = EXCLUDED.out_octets,
                 in_rate_bps = EXCLUDED.in_rate_bps,
                 out_rate_bps = EXCLUDED.out_rate_bps,
                 in_errors = EXCLUDED.in_errors,
                 out_errors = EXCLUDED.out_errors,
                 in_discards = EXCLUDED.in_discards,
                 out_discards = EXCLUDED.out_discards,
                 updated_at = NOW()`,
            [
              oltId,
              iface.ifIndex,
              iface.ifName,
              iface.ifDescr,
              iface.ifType,
              iface.adminStatus,
              iface.operStatus,
              iface.speedBps,
              iface.macAddress || null,
              iface.mtu || 1500,
              iface.inOctets,
              iface.outOctets,
              iface.inRateBps,
              iface.outRateBps,
              iface.inErrors,
              iface.outErrors,
              iface.inDiscards,
              iface.outDiscards,
            ]
          ).catch((e) => {
            console.warn(`[OLT Poller] Failed to upsert interface ${iface.ifIndex}:`, e.message);
          });
        }
      }

      // 3. Update optical readings in onus table for registered serials
      if (telemetry.onus.length > 0) {
        for (const onu of telemetry.onus) {
          if (!onu.serialNumber) continue;
          await query(
            `UPDATE onus
                SET run_state = $2,
                    last_rx_power = $3,
                    last_tx_power = $4,
                    last_olt_rx_power = $5,
                    last_optical_reading_at = NOW(),
                    updated_at = NOW()
              WHERE olt_id = $1 AND serial_number = $6`,
            [
              oltId,
              onu.runState,
              onu.rxPowerDbm,
              onu.txPowerDbm,
              onu.oltRxPowerDbm,
              onu.serialNumber,
            ]
          ).catch(() => {});
        }
      }

      // 4. Upsert Alarms into olt_alarms table
      if (telemetry.alarms.length > 0) {
        for (const alarm of telemetry.alarms) {
          await query(
            `INSERT INTO olt_alarms (
               olt_id, alarm_id, severity, title, description, raised_at
             ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              oltId,
              alarm.alarmId,
              alarm.severity,
              alarm.title,
              alarm.description,
              alarm.raisedAt,
            ]
          ).catch(() => {});
        }
      }
    } catch (err: any) {
      console.error(`[OLT Poller] DB save error for OLT ${oltId}:`, err.message);
    }
  }

  /**
   * Retrieve cached or persisted telemetry for an OLT
   */
  async getTelemetry(oltId: number): Promise<OltNormalizedTelemetry | null> {
    const cached = lastTelemetryCache.get(oltId);
    if (cached) return cached;

    // Fallback to database
    const { rows } = await query<any>(
      `SELECT telemetry_data, last_poll_at, last_poll_status, last_poll_error
         FROM olts
        WHERE id = $1`,
      [oltId]
    );

    if (rows[0] && rows[0].telemetry_data && Object.keys(rows[0].telemetry_data).length > 0) {
      const data = rows[0].telemetry_data as OltNormalizedTelemetry;
      lastTelemetryCache.set(oltId, data);
      return data;
    }

    return null;
  }
}

export const oltPollerService = new OltPollerService();
