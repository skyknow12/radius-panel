import { query } from '../db/pool';

export interface NasDeviceRow {
  id: number;
  name: string;
  ip_address: string;
  nas_type: string;
  location: string | null;
  status: 'online' | 'warning' | 'offline' | 'unknown';
  last_seen_at: Date | null;
  sessions: string;
}

/** Panel NAS inventory (nas_devices) + FreeRADIUS client table (nas). */
export const nasRepository = {
  async listWithSessions(): Promise<NasDeviceRow[]> {
    const { rows } = await query<NasDeviceRow>(
      `SELECT nd.id, nd.name, host(nd.ip_address) AS ip_address, nd.nas_type, nd.location,
              nd.status, nd.last_seen_at, COALESCE(s.sessions, 0) AS sessions
         FROM nas_devices nd
         LEFT JOIN (
           SELECT nasipaddress, COUNT(*) AS sessions
             FROM radacct WHERE acctstoptime IS NULL
            GROUP BY nasipaddress
         ) s ON s.nasipaddress = nd.ip_address
        WHERE nd.is_active
        ORDER BY sessions DESC, nd.name`,
    );
    return rows;
  },

  async countDevices(): Promise<number> {
    const { rows } = await query<{ count: string }>('SELECT COUNT(*) FROM nas_devices WHERE is_active');
    return Number(rows[0]?.count ?? 0);
  },

  /** Number of RADIUS clients defined in the FreeRADIUS `nas` table. */
  async countRadiusClients(): Promise<number> {
    const { rows } = await query<{ count: string }>('SELECT COUNT(*) FROM nas');
    return Number(rows[0]?.count ?? 0);
  },
};

/** Counts over FreeRADIUS authorisation tables. */
export const radiusUserRepository = {
  async countUsers(): Promise<number> {
    const { rows } = await query<{ count: string }>('SELECT COUNT(DISTINCT username) FROM radcheck');
    return Number(rows[0]?.count ?? 0);
  },

  async countGroups(): Promise<number> {
    const { rows } = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT groupname) FROM (
         SELECT groupname FROM radgroupreply UNION SELECT groupname FROM radgroupcheck
       ) g`,
    );
    return Number(rows[0]?.count ?? 0);
  },
};
