import { TelnetClient } from './telnet-client';
import { huaweiParser, BoardInfo, OntInfo, DiscoveredOnt, OpticalInfo } from './huawei-parser';
import { logger } from '../../lib/logger';
import { sanitizeLogOutput } from '../../lib/crypto';

export interface OltConnectionConfig {
  host: string;
  port: number;
  protocol: 'telnet' | 'ssh';
  username: string;
  passwordDecrypted: string;
  timeoutMs?: number;
}

export class HuaweiMA5683TDriver {
  /**
   * Helper to open a login session to the Huawei OLT
   */
  private async openSession(config: OltConnectionConfig): Promise<{ client: TelnetClient; cleanup: () => void }> {
    const client = new TelnetClient();
    const timeoutMs = config.timeoutMs || 10000;

    await client.connect({
      host: config.host,
      port: config.port || 23,
      timeoutMs,
    });

    // 1. Wait for username prompt
    await client.waitFor([/[Uu]sername\s*:\s*$/, /[Ll]ogin\s*:\s*$/], timeoutMs);
    await client.write(config.username + '\n');

    // 2. Wait for password prompt
    await client.waitFor([/[Pp]assword\s*:\s*$/], timeoutMs);
    await client.write(config.passwordDecrypted + '\n');

    // 3. Wait for CLI prompt (> or #)
    const promptRes = await client.waitFor([/>\s*$/, /#\s*$/], timeoutMs);

    // 4. Enter enable mode if at user prompt (>)
    if (promptRes.matchedText.includes('>')) {
      await client.write('enable\n');
      await client.waitFor([/#\s*$/], timeoutMs);
    }

    // 5. Disable pagination for smooth programmatic execution
    try {
      await client.execCommand('undo smart', [/#\s*$/, />\s*$/], 5000);
    } catch {}

    const cleanup = () => {
      try {
        client.disconnect();
      } catch {}
    };

    return { client, cleanup };
  }

  /**
   * Test CLI connectivity and retrieve installed board inventory
   */
  public async testConnection(config: OltConnectionConfig): Promise<{
    success: boolean;
    message: string;
    boards: BoardInfo[];
    rawOutput?: string;
  }> {
    let session: { client: TelnetClient; cleanup: () => void } | null = null;
    try {
      session = await this.openSession(config);
      const boardOutput = await session.client.execCommand('display board 0', [/#\s*$/], config.timeoutMs || 10000);
      const boards = huaweiParser.parseBoards(boardOutput);

      const gponCount = boards.filter((b) => b.isGpon).length;
      const controlCount = boards.filter((b) => b.isControl).length;

      return {
        success: true,
        message: `Successfully connected to Huawei MA5683T. Detected ${boards.length} boards (${gponCount} GPON, ${controlCount} Control).`,
        boards,
        rawOutput: sanitizeLogOutput(boardOutput, [config.passwordDecrypted]),
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Connection failed: ${err.message}`,
        boards: [],
      };
    } finally {
      session?.cleanup();
    }
  }

  /**
   * Retrieve chassis boards inventory
   */
  public async getBoards(config: OltConnectionConfig): Promise<BoardInfo[]> {
    let session: { client: TelnetClient; cleanup: () => void } | null = null;
    try {
      session = await this.openSession(config);
      const output = await session.client.execCommand('display board 0', [/#\s*$/], config.timeoutMs || 10000);
      return huaweiParser.parseBoards(output);
    } finally {
      session?.cleanup();
    }
  }

  /**
   * Enumerate and parse all registered ONUs across GPON boards and ports
   */
  public async getRegisteredOnus(
    config: OltConnectionConfig,
    options?: { slot?: number; port?: number }
  ): Promise<OntInfo[]> {
    let session: { client: TelnetClient; cleanup: () => void } | null = null;
    const allOnus: OntInfo[] = [];

    try {
      session = await this.openSession(config);
      const client = session.client;

      // Determine slots to query
      let targetSlots: number[] = [];
      if (options?.slot !== undefined) {
        targetSlots = [options.slot];
      } else {
        const boardOutput = await client.execCommand('display board 0', [/#\s*$/], 10000);
        const boards = huaweiParser.parseBoards(boardOutput);
        targetSlots = boards.filter((b) => b.isGpon).map((b) => b.slot);
        if (targetSlots.length === 0) {
          // Default known MA5683T slots
          targetSlots = [0, 2, 3, 5];
        }
      }

      await client.execCommand('config', [/\(config\)#\s*$/], 5000);

      for (const slot of targetSlots) {
        try {
          await client.execCommand(`interface gpon 0/${slot}`, [/\(config-if-gpon-.*\)?#\s*$/], 5000);

          const portsToQuery = options?.port !== undefined ? [options.port] : Array.from({ length: 16 }, (_, i) => i);
          for (const p of portsToQuery) {
            try {
              const ontOutput = await client.execCommand(
                `display ont info ${p} all`,
                [/\(config-if-gpon-.*\)?#\s*$/],
                12000
              );
              const parsed = huaweiParser.parseOntInfoAll(ontOutput, slot, p);
              allOnus.push(...parsed);
            } catch (portErr: any) {
              logger.debug({ slot, port: p, err: portErr.message }, 'No ONUs or query error on port');
            }
          }

          await client.execCommand('quit', [/\(config\)#\s*$/], 5000);
        } catch (slotErr: any) {
          logger.warn({ slot, err: slotErr.message }, 'Failed querying GPON slot');
          try {
            await client.execCommand('quit', [/#\s*$/, /\(config\)#\s*$/], 3000);
          } catch {}
        }
      }

      return allOnus;
    } finally {
      session?.cleanup();
    }
  }

  /**
   * Discover unregistered ONUs via autofind
   */
  public async discoverUnregisteredOnus(
    config: OltConnectionConfig,
    options?: { slot?: number; port?: number }
  ): Promise<DiscoveredOnt[]> {
    let session: { client: TelnetClient; cleanup: () => void } | null = null;
    const discovered: DiscoveredOnt[] = [];

    try {
      session = await this.openSession(config);
      const client = session.client;

      // First attempt global autofind command
      try {
        const autofindAll = await client.execCommand('display ont autofind all', [/#\s*$/], 12000);
        const parsed = huaweiParser.parseAutofind(autofindAll);
        if (parsed.length > 0) {
          return parsed;
        }
      } catch {}

      // If global was empty or failed, query specific interface if specified
      if (options?.slot !== undefined) {
        await client.execCommand('config', [/\(config\)#\s*$/], 5000);
        await client.execCommand(`interface gpon 0/${options.slot}`, [/\(config-if-gpon-.*\)?#\s*$/], 5000);

        const portCmd = options.port !== undefined ? `display ont autofind ${options.port}` : 'display ont autofind all';
        const portOut = await client.execCommand(portCmd, [/\(config-if-gpon-.*\)?#\s*$/], 8000);
        const parsed = huaweiParser.parseAutofind(portOut, options.slot, options.port || 0);
        discovered.push(...parsed);

        await client.execCommand('quit', [/\(config\)#\s*$/], 5000);
        await client.execCommand('quit', [/#\s*$/], 5000);
      }

      return discovered;
    } finally {
      session?.cleanup();
    }
  }

  /**
   * Read live optical power info for a specific ONT
   */
  public async getOpticalInfo(
    config: OltConnectionConfig,
    slot: number,
    port: number,
    ontId: number
  ): Promise<OpticalInfo> {
    let session: { client: TelnetClient; cleanup: () => void } | null = null;
    try {
      session = await this.openSession(config);
      const client = session.client;

      await client.execCommand('config', [/\(config\)#\s*$/], 5000);
      await client.execCommand(`interface gpon 0/${slot}`, [/\(config-if-gpon-.*\)?#\s*$/], 5000);

      const opticalOutput = await client.execCommand(
        `display ont optical-info ${port} ${ontId}`,
        [/\(config-if-gpon-.*\)?#\s*$/],
        10000
      );

      const parsed = huaweiParser.parseOpticalInfo(opticalOutput);

      await client.execCommand('quit', [/\(config\)#\s*$/], 5000);
      await client.execCommand('quit', [/#\s*$/], 5000);

      return parsed;
    } finally {
      session?.cleanup();
    }
  }

  /**
   * Complete multi-step ONU provisioning:
   * 1. Register ONT via SN authentication
   * 2. Extract actual assigned ONT ID
   * 3. Create service-port configuration
   * 4. Verify service-port
   */
  public async provisionOnu(
    config: OltConnectionConfig,
    params: {
      slot: number;
      port: number;
      serialNumber: string;
      lineProfileId: number;
      serviceProfileId: number;
      description?: string;
      vlanId: number;
      userVlanId: number;
      gemPort?: number;
      tagTransform?: string;
    }
  ): Promise<{
    success: boolean;
    assignedOntId: number;
    servicePortCreated: boolean;
    servicePortIndex?: number;
    commandsExecuted: string[];
    logs: string;
    errorStep?: string;
    errorMessage?: string;
  }> {
    let session: { client: TelnetClient; cleanup: () => void } | null = null;
    const commandsExecuted: string[] = [];
    const logBuffer: string[] = [];
    const gemPort = params.gemPort || 10;
    const tagTransform = params.tagTransform || 'translate';

    try {
      session = await this.openSession(config);
      const client = session.client;

      // STEP 1: Enter GPON Interface context
      await client.execCommand('config', [/\(config\)#\s*$/], 5000);
      commandsExecuted.push('config');

      await client.execCommand(`interface gpon 0/${params.slot}`, [/\(config-if-gpon-.*\)?#\s*$/], 5000);
      commandsExecuted.push(`interface gpon 0/${params.slot}`);

      // STEP 2: Execute ont add command
      let ontAddCmd = `ont add ${params.port} sn-auth ${params.serialNumber} omci ont-lineprofile-id ${params.lineProfileId} ont-srvprofile-id ${params.serviceProfileId}`;
      if (params.description) {
        // Sanitize description: alphanumeric, hyphens, underscores only
        const cleanDesc = params.description.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
        if (cleanDesc) {
          ontAddCmd += ` desc "${cleanDesc}"`;
        }
      }

      commandsExecuted.push(ontAddCmd);
      const addRes = await client.execCommand(ontAddCmd, [/\(config-if-gpon-.*\)?#\s*$/], 15000);
      logBuffer.push(addRes);

      const addErr = huaweiParser.detectCliError(addRes);
      if (addErr) {
        return {
          success: false,
          assignedOntId: -1,
          servicePortCreated: false,
          commandsExecuted,
          logs: logBuffer.join('\n'),
          errorStep: 'ont_add',
          errorMessage: addErr,
        };
      }

      // STEP 3: Extract actual assigned ONT ID
      let assignedOntId = huaweiParser.parseAssignedOntId(addRes);
      if (assignedOntId === null) {
        // Fallback: Query ont info to look up the newly registered SN
        const infoRes = await client.execCommand(
          `display ont info ${params.port} all`,
          [/\(config-if-gpon-.*\)?#\s*$/],
          10000
        );
        const onus = huaweiParser.parseOntInfoAll(infoRes, params.slot, params.port);
        const found = onus.find((o) => o.serialNumber.toLowerCase() === params.serialNumber.toLowerCase());
        if (found) {
          assignedOntId = found.ontId;
        }
      }

      if (assignedOntId === null) {
        return {
          success: false,
          assignedOntId: -1,
          servicePortCreated: false,
          commandsExecuted,
          logs: logBuffer.join('\n'),
          errorStep: 'extract_ont_id',
          errorMessage: 'Could not determine the allocated ONT ID from the OLT response',
        };
      }

      // Exit back to config mode for service-port creation
      await client.execCommand('quit', [/\(config\)#\s*$/], 5000);
      commandsExecuted.push('quit');

      // STEP 4: Create service-port
      const spCmd = `service-port vlan ${params.vlanId} gpon 0/${params.slot}/${params.port} ont ${assignedOntId} gemport ${gemPort} multi-service user-vlan ${params.userVlanId} tag-transform ${tagTransform}`;
      commandsExecuted.push(spCmd);
      const spRes = await client.execCommand(spCmd, [/\(config\)#\s*$/, /\[n\]:\s*$/], 15000);
      logBuffer.push(spRes);

      // If OLT prompts for confirmation: Confirm to add this service-port? (y/n)[n]:
      if (spRes.includes('[n]:')) {
        const confirmRes = await client.execCommand('y', [/\(config\)#\s*$/], 10000);
        logBuffer.push(confirmRes);
      }

      const spErr = huaweiParser.detectCliError(spRes);
      if (spErr) {
        // Partial success: ONT was registered, but service port failed!
        return {
          success: false,
          assignedOntId,
          servicePortCreated: false,
          commandsExecuted,
          logs: logBuffer.join('\n'),
          errorStep: 'service_port_create',
          errorMessage: spErr,
        };
      }

      // STEP 5: Verify service port
      const verifyCmd = `display service-port port 0/${params.slot}/${params.port} ont ${assignedOntId}`;
      commandsExecuted.push(verifyCmd);
      const verifyRes = await client.execCommand(verifyCmd, [/\(config\)#\s*$/], 10000);
      logBuffer.push(verifyRes);
      const parsedPorts = huaweiParser.parseServicePorts(verifyRes);

      return {
        success: true,
        assignedOntId,
        servicePortCreated: true,
        servicePortIndex: parsedPorts[0]?.index,
        commandsExecuted,
        logs: logBuffer.join('\n'),
      };
    } catch (err: any) {
      return {
        success: false,
        assignedOntId: -1,
        servicePortCreated: false,
        commandsExecuted,
        logs: logBuffer.join('\n'),
        errorStep: 'execution_exception',
        errorMessage: err.message,
      };
    } finally {
      session?.cleanup();
    }
  }

  /**
   * Delete registered ONU from OLT
   * 1. Find and remove associated service port(s)
   * 2. Remove ONT in interface GPON
   */
  public async deleteOnu(
    config: OltConnectionConfig,
    params: {
      slot: number;
      port: number;
      ontId: number;
      servicePortId?: number;
    }
  ): Promise<{ success: boolean; commandsExecuted: string[]; logs: string; errorMessage?: string }> {
    let session: { client: TelnetClient; cleanup: () => void } | null = null;
    const commandsExecuted: string[] = [];
    const logBuffer: string[] = [];

    try {
      session = await this.openSession(config);
      const client = session.client;

      await client.execCommand('config', [/\(config\)#\s*$/], 5000);
      commandsExecuted.push('config');

      // 1. Undo service port if given or discover it
      if (params.servicePortId) {
        const undoSpCmd = `undo service-port ${params.servicePortId}`;
        commandsExecuted.push(undoSpCmd);
        const undoRes = await client.execCommand(undoSpCmd, [/\(config\)#\s*$/, /\[n\]:\s*$/], 10000);
        logBuffer.push(undoRes);
        if (undoRes.includes('[n]:')) {
          await client.execCommand('y', [/\(config\)#\s*$/], 5000);
        }
      } else {
        // Query service ports on this ont
        try {
          const spQuery = await client.execCommand(
            `display service-port port 0/${params.slot}/${params.port} ont ${params.ontId}`,
            [/\(config\)#\s*$/],
            8000
          );
          const ports = huaweiParser.parseServicePorts(spQuery);
          for (const sp of ports) {
            const undoCmd = `undo service-port ${sp.index}`;
            commandsExecuted.push(undoCmd);
            const uRes = await client.execCommand(undoCmd, [/\(config\)#\s*$/, /\[n\]:\s*$/], 10000);
            logBuffer.push(uRes);
            if (uRes.includes('[n]:')) {
              await client.execCommand('y', [/\(config\)#\s*$/], 5000);
            }
          }
        } catch {}
      }

      // 2. Enter GPON interface and delete ONT
      await client.execCommand(`interface gpon 0/${params.slot}`, [/\(config-if-gpon-.*\)?#\s*$/], 5000);
      commandsExecuted.push(`interface gpon 0/${params.slot}`);

      const delCmd = `ont delete ${params.port} ${params.ontId}`;
      commandsExecuted.push(delCmd);
      const delRes = await client.execCommand(delCmd, [/\(config-if-gpon-.*\)?#\s*$/], 12000);
      logBuffer.push(delRes);

      const delErr = huaweiParser.detectCliError(delRes);
      if (delErr) {
        return {
          success: false,
          commandsExecuted,
          logs: logBuffer.join('\n'),
          errorMessage: delErr,
        };
      }

      await client.execCommand('quit', [/\(config\)#\s*$/], 5000);
      commandsExecuted.push('quit');

      return {
        success: true,
        commandsExecuted,
        logs: logBuffer.join('\n'),
      };
    } catch (err: any) {
      return {
        success: false,
        commandsExecuted,
        logs: logBuffer.join('\n'),
        errorMessage: err.message,
      };
    } finally {
      session?.cleanup();
    }
  }
}

export const huaweiDriver = new HuaweiMA5683TDriver();
