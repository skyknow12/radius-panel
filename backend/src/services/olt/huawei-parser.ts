/**
 * Huawei MA5683T CLI Output Parsers
 * Firmware: MA5600V800R015C00 (SPC108 HP1019)
 */

export interface BoardInfo {
  slot: number;
  boardName: string;
  status: string;
  isGpon: boolean;
  isControl: boolean;
  isStandby: boolean;
}

export interface OntInfo {
  frame: number;
  slot: number;
  ponPort: number;
  ontId: number;
  serialNumber: string;
  controlFlag: string;
  runState: 'online' | 'offline' | 'missing' | 'unknown';
  configState: 'initial' | 'normal' | 'failed' | 'unknown';
  matchState: 'match' | 'mismatch' | 'unknown';
  protectionState?: string;
  authType?: string;
  managementMode?: string;
  description?: string;
  lineProfileId?: number;
  lineProfileName?: string;
  serviceProfileId?: number;
  serviceProfileName?: string;
  lastUpTime?: string;
  lastDownTime?: string;
  lastDownCause?: string;
}

export interface DiscoveredOnt {
  frame: number;
  slot: number;
  ponPort: number;
  serialNumber: string;
  vendorId?: string;
  equipmentId?: string;
  version?: string;
  discoveryTime?: string;
}

export interface OpticalInfo {
  rxPower: number | null; // dBm (ONU Rx from OLT)
  txPower: number | null; // dBm (ONU Tx)
  oltRxPower: number | null; // dBm (OLT Rx from ONU)
  temperature: number | null; // Celsius
  voltage: number | null; // Volts
  biasCurrent: number | null; // mA
  isAvailable: boolean;
  rawText?: string;
}

export interface ServicePortInfo {
  index: number;
  vlanId: number;
  frame: number;
  slot: number;
  ponPort: number;
  ontId: number;
  gemPort: number;
  userVlanId: number;
  tagTransform: string;
  state: string;
}

export const huaweiParser = {
  /**
   * Parse `display board 0`
   */
  parseBoards(output: string): BoardInfo[] {
    const boards: BoardInfo[] = [];
    const lines = output.split('\n');

    for (const rawLine of lines) {
      const line = rawLine.trim();
      // Match lines like: "0       H805GPFD   Normal" or "6       H802SCUN   Standby_normal"
      const match = line.match(/^(\d+)\s+([A-Z0-9]+)\s+([A-Za-z0-9_]+)/);
      if (match) {
        const slot = parseInt(match[1], 10);
        const boardName = match[2].toUpperCase();
        const status = match[3];

        const isGpon = boardName.includes('GPFD') || boardName.includes('GPBD') || boardName.includes('GPUF') || boardName.includes('GPON');
        const isControl = boardName.includes('SCUN') || boardName.includes('MCUD') || boardName.includes('MPU');
        const isStandby = status.toLowerCase().includes('standby');

        boards.push({
          slot,
          boardName,
          status,
          isGpon,
          isControl,
          isStandby,
        });
      }
    }

    return boards;
  },

  /**
   * Parse `display ont info <port> all` (block and tabular forms)
   */
  parseOntInfoAll(output: string, defaultSlot = 0, defaultPort = 0): OntInfo[] {
    const list: OntInfo[] = [];

    // Check block style output first:
    // F/S/P: 0/0/0
    // ONT-ID: 1
    // ...
    if (output.includes('F/S/P') || output.includes('ONT-ID')) {
      const blocks = output.split(/-----------------------------------------------------------------------------+/);
      for (const block of blocks) {
        if (!block.trim()) continue;

        const fspMatch = block.match(/F\/S\/P\s*:\s*(\d+)\/(\d+)\/(\d+)/i);
        const ontIdMatch = block.match(/ONT-ID\s*:\s*(\d+)/i) || block.match(/ONT\s*ID\s*:\s*(\d+)/i);
        const snMatch = block.match(/SN\s*:\s*([A-Za-z0-9]+)/i) || block.match(/Ont\s*SN\s*:\s*([A-Za-z0-9]+)/i);

        if (ontIdMatch && snMatch) {
          const frame = fspMatch ? parseInt(fspMatch[1], 10) : 0;
          const slot = fspMatch ? parseInt(fspMatch[2], 10) : defaultSlot;
          const ponPort = fspMatch ? parseInt(fspMatch[3], 10) : defaultPort;
          const ontId = parseInt(ontIdMatch[1], 10);
          const serialNumber = snMatch[1].trim();

          const runMatch = block.match(/Run\s*state\s*:\s*([A-Za-z0-9_-]+)/i);
          const cfgMatch = block.match(/Config\s*state\s*:\s*([A-Za-z0-9_-]+)/i);
          const matchMatch = block.match(/Match\s*state\s*:\s*([A-Za-z0-9_-]+)/i);
          const ctrlMatch = block.match(/Control\s*flag\s*:\s*([A-Za-z0-9_-]+)/i);
          const descMatch = block.match(/Description\s*:\s*(.+)/i);
          const authMatch = block.match(/Authentic\s*type\s*:\s*([A-Za-z0-9_-]+)/i);
          const mgmtMatch = block.match(/Management\s*mode\s*:\s*([A-Za-z0-9_-]+)/i);
          const lpIdMatch = block.match(/Line\s*profile\s*ID\s*:\s*(\d+)/i);
          const lpNameMatch = block.match(/Line\s*profile\s*name\s*:\s*([^\r\n]+)/i);
          const spIdMatch = block.match(/Service\s*profile\s*ID\s*:\s*(\d+)/i);
          const spNameMatch = block.match(/Service\s*profile\s*name\s*:\s*([^\r\n]+)/i);
          const lastUpMatch = block.match(/Last\s*up\s*time\s*:\s*([^\r\n]+)/i);
          const lastDownMatch = block.match(/Last\s*down\s*time\s*:\s*([^\r\n]+)/i);
          const lastDownCauseMatch = block.match(/Last\s*down\s*cause\s*:\s*([^\r\n]+)/i);

          const runStateRaw = (runMatch ? runMatch[1].toLowerCase() : 'offline');
          let runState: 'online' | 'offline' | 'missing' | 'unknown' = 'offline';
          if (runStateRaw.includes('online')) runState = 'online';
          else if (runStateRaw.includes('offline')) runState = 'offline';
          else if (runStateRaw.includes('miss')) runState = 'missing';

          const cfgRaw = (cfgMatch ? cfgMatch[1].toLowerCase() : 'initial');
          let configState: 'initial' | 'normal' | 'failed' | 'unknown' = 'initial';
          if (cfgRaw.includes('norm')) configState = 'normal';
          else if (cfgRaw.includes('init')) configState = 'initial';
          else if (cfgRaw.includes('fail')) configState = 'failed';

          const matchRaw = (matchMatch ? matchMatch[1].toLowerCase() : 'match');
          let matchState: 'match' | 'mismatch' | 'unknown' = 'match';
          if (matchRaw.includes('mismatch')) matchState = 'mismatch';
          else if (matchRaw.includes('match')) matchState = 'match';

          list.push({
            frame,
            slot,
            ponPort,
            ontId,
            serialNumber,
            controlFlag: ctrlMatch ? ctrlMatch[1] : 'active',
            runState,
            configState,
            matchState,
            authType: authMatch ? authMatch[1] : 'SN-auth',
            managementMode: mgmtMatch ? mgmtMatch[1] : 'OMCI',
            description: descMatch ? descMatch[1].trim() : undefined,
            lineProfileId: lpIdMatch ? parseInt(lpIdMatch[1], 10) : undefined,
            lineProfileName: lpNameMatch ? lpNameMatch[1].trim() : undefined,
            serviceProfileId: spIdMatch ? parseInt(spIdMatch[1], 10) : undefined,
            serviceProfileName: spNameMatch ? spNameMatch[1].trim() : undefined,
            lastUpTime: lastUpMatch ? lastUpMatch[1].trim() : undefined,
            lastDownTime: lastDownMatch ? lastDownMatch[1].trim() : undefined,
            lastDownCause: lastDownCauseMatch ? lastDownCauseMatch[1].trim() : undefined,
          });
        }
      }
    }

    // Also parse tabular style if any lines match tabular structure:
    // 0/0/0   0        active       online   normal     match    none      485754435F9E5B9E
    const lines = output.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      const tabMatch = line.match(/^(\d+)\/(\d+)\/(\d+)\s+(\d+)\s+([A-Za-z0-9_-]+)\s+([A-Za-z0-9_-]+)\s+([A-Za-z0-9_-]+)\s+([A-Za-z0-9_-]+)\s+([A-Za-z0-9_-]+)\s+([A-Za-z0-9]{12,16})/);
      if (tabMatch) {
        const frame = parseInt(tabMatch[1], 10);
        const slot = parseInt(tabMatch[2], 10);
        const ponPort = parseInt(tabMatch[3], 10);
        const ontId = parseInt(tabMatch[4], 10);
        const controlFlag = tabMatch[5];
        const runRaw = tabMatch[6].toLowerCase();
        const cfgRaw = tabMatch[7].toLowerCase();
        const matchRaw = tabMatch[8].toLowerCase();
        const protectionState = tabMatch[9];
        const serialNumber = tabMatch[10];

        // Check if not already parsed in block mode
        if (!list.some((o) => o.frame === frame && o.slot === slot && o.ponPort === ponPort && o.ontId === ontId)) {
          list.push({
            frame,
            slot,
            ponPort,
            ontId,
            serialNumber,
            controlFlag,
            runState: runRaw.includes('online') ? 'online' : 'offline',
            configState: cfgRaw.includes('norm') ? 'normal' : 'initial',
            matchState: matchRaw.includes('mismatch') ? 'mismatch' : 'match',
            protectionState,
          });
        }
      }
    }

    return list;
  },

  /**
   * Parse `display ont autofind all` or `display ont autofind <port>`
   */
  parseAutofind(output: string, defaultSlot = 0, defaultPort = 0): DiscoveredOnt[] {
    const list: DiscoveredOnt[] = [];

    // Check for "no found" message:
    if (
      output.includes('No automatically find ONT is found') ||
      output.includes('The automatically found ONT does not exist') ||
      output.includes('There is no automatically find ONT') ||
      output.includes('no automatically find')
    ) {
      return [];
    }

    const blocks = output.split(/----------------------------------------------------------------------------+/);
    for (const block of blocks) {
      if (!block.trim()) continue;

      const snMatch = block.match(/Ont\s*SN\s*:\s*([A-Za-z0-9]+)/i);
      if (snMatch) {
        const serialNumber = snMatch[1].trim();
        const fspMatch = block.match(/F\/S\/P\s*:\s*(\d+)\/(\d+)\/(\d+)/i);
        const frame = fspMatch ? parseInt(fspMatch[1], 10) : 0;
        const slot = fspMatch ? parseInt(fspMatch[2], 10) : defaultSlot;
        const ponPort = fspMatch ? parseInt(fspMatch[3], 10) : defaultPort;

        const vendorMatch = block.match(/Vendor-ID\s*:\s*([A-Za-z0-9_-]+)/i);
        const versionMatch = block.match(/Ont\s*Version\s*:\s*([A-Za-z0-9._-]+)/i);
        const eqMatch = block.match(/Ont\s*EquipmentID\s*:\s*([A-Za-z0-9._-]+)/i);
        const timeMatch = block.match(/Ont\s*autofind\s*time\s*:\s*([^\r\n]+)/i);

        list.push({
          frame,
          slot,
          ponPort,
          serialNumber,
          vendorId: vendorMatch ? vendorMatch[1].trim() : undefined,
          equipmentId: eqMatch ? eqMatch[1].trim() : undefined,
          version: versionMatch ? versionMatch[1].trim() : undefined,
          discoveryTime: timeMatch ? timeMatch[1].trim() : undefined,
        });
      }
    }

    return list;
  },

  /**
   * Parse `display ont optical-info <port> <ont-id>`
   */
  parseOpticalInfo(output: string): OpticalInfo {
    // Check if optical is unavailable or offline:
    if (
      output.includes('Failure: The ONT is not online') ||
      output.includes('Failure:') ||
      output.includes('The port does not exist') ||
      output.includes('Error:')
    ) {
      return {
        rxPower: null,
        txPower: null,
        oltRxPower: null,
        temperature: null,
        voltage: null,
        biasCurrent: null,
        isAvailable: false,
        rawText: output.trim(),
      };
    }

    // Rx optical power(dBm) : -21.45
    // Tx optical power(dBm) : 2.30
    // OLT Rx ONT optical power(dBm) : -22.10
    // Temperature(C) : 38
    // Supply Voltage(V) : 3.28
    // Laser bias current(mA) : 15.2
    const parseNum = (re: RegExp): number | null => {
      const m = output.match(re);
      if (m && m[1] && m[1] !== '-' && !m[1].toLowerCase().includes('null')) {
        const val = parseFloat(m[1]);
        return isNaN(val) ? null : val;
      }
      return null;
    };

    const rxPower = parseNum(/Rx\s*optical\s*power(?:\(dBm\))?\s*:\s*([-\d.]+)/i);
    const txPower = parseNum(/Tx\s*optical\s*power(?:\(dBm\))?\s*:\s*([-\d.]+)/i);
    const oltRxPower = parseNum(/OLT\s*Rx\s*(?:ONT\s*)?optical\s*power(?:\(dBm\))?\s*:\s*([-\d.]+)/i);
    const temperature = parseNum(/Temperature(?:\(C\))?\s*:\s*([-\d.]+)/i);
    const voltage = parseNum(/Supply\s*Voltage(?:\(V\))?\s*:\s*([-\d.]+)/i);
    const biasCurrent = parseNum(/Laser\s*bias\s*current(?:\(mA\))?\s*:\s*([-\d.]+)/i);

    const isAvailable = rxPower !== null || oltRxPower !== null;

    return {
      rxPower,
      txPower,
      oltRxPower,
      temperature,
      voltage,
      biasCurrent,
      isAvailable,
      rawText: output.trim(),
    };
  },

  /**
   * Parse `ont add` response to extract actual assigned ONT ID
   * Examples:
   * "Add ONT successfully, ONT ID is 3"
   * "ONT-ID: 3"
   * "The ONT ID is 3"
   */
  parseAssignedOntId(output: string): number | null {
    const patterns = [
      /Add\s*ONT\s*successfully[,\s]+ONT\s*ID\s*is\s*(\d+)/i,
      /ONT\s*ID\s*is\s*(\d+)/i,
      /ONT-ID\s*:\s*(\d+)/i,
      /The\s*ONT\s*ID\s*is\s*(\d+)/i,
      /ONT\s*id\s*:\s*(\d+)/i,
    ];

    for (const re of patterns) {
      const match = output.match(re);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
    }

    return null;
  },

  /**
   * Parse `display service-port ...` output
   */
  parseServicePorts(output: string): ServicePortInfo[] {
    const ports: ServicePortInfo[] = [];
    const lines = output.split('\n');

    for (const rawLine of lines) {
      const line = rawLine.trim();
      // Match lines like:
      // 152   738  common  gpon  0/ 0/ 0  3   10   738  translate  up
      const match = line.match(/^(\d+)\s+(\d+)\s+\S+\s+gpon\s+(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([A-Za-z0-9_-]+)\s+([A-Za-z0-9_-]+)/i);
      if (match) {
        ports.push({
          index: parseInt(match[1], 10),
          vlanId: parseInt(match[2], 10),
          frame: parseInt(match[3], 10),
          slot: parseInt(match[4], 10),
          ponPort: parseInt(match[5], 10),
          ontId: parseInt(match[6], 10),
          gemPort: parseInt(match[7], 10),
          userVlanId: parseInt(match[8], 10),
          tagTransform: match[9],
          state: match[10],
        });
      }
    }

    return ports;
  },

  /**
   * Check if a CLI response represents an error or command failure
   */
  detectCliError(output: string): string | null {
    if (!output) return null;

    const failurePatterns = [
      /Failure:\s*(.+)/i,
      /Error:\s*(.+)/i,
      /Unknown\s*command\s*(.+)/i,
      /Parameter\s*error\s*(.+)/i,
      /The\s*port\s*does\s*not\s*exist/i,
      /The\s*ONT\s*already\s*exists/i,
      /The\s*SN\s*has\s*already\s*been\s*used/i,
    ];

    for (const re of failurePatterns) {
      const match = output.match(re);
      if (match) {
        return match[1] ? match[1].trim() : match[0].trim();
      }
    }

    return null;
  },
};
