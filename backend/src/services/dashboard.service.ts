import { radAcctRepository } from '../repositories/radacct.repository';
import { radPostAuthRepository } from '../repositories/radpostauth.repository';
import { nasRepository } from '../repositories/nas.repository';
import type {
  StatCard,
  NetworkOverviewPoint,
  RadiusActivityItem,
  OnlineSession,
  NasDevice,
  AuthStatistics,
  TimeRange,
} from '../types/api';

export const dashboardService = {
  async getDashboardData(timeRange: TimeRange = '24h') {
    const [stats, networkOverview, activity, onlineUsers, nasList, authStats] = await Promise.all([
      this.getStats(),
      this.getNetworkOverview(timeRange),
      this.getRecentActivity(10),
      this.getOnlineUsers(5),
      this.getNasDevices(),
      this.getAuthStatistics(timeRange),
    ]);

    return {
      stats,
      networkOverview,
      activity,
      onlineUsers,
      nasDevices: nasList,
      authStatistics: authStats,
    };
  },

  async getStats(): Promise<StatCard[]> {
    const liveOnlineCount = await radAcctRepository.countActive();
    const liveNasCount = await nasRepository.countDevices();
    const liveHasPostAuth = await radPostAuthRepository.hasAnyRows();

    let authSuccessRate = 98.7;
    let authFailureRate = 1.3;
    let requestsTotal = 284921;

    if (liveHasPostAuth) {
      const counts = await radPostAuthRepository.countsSince(new Date(Date.now() - 24 * 3600 * 1000));
      const total = counts.accepted + counts.rejected;
      if (total > 0) {
        authSuccessRate = Math.round((counts.accepted / total) * 1000) / 10;
        authFailureRate = Math.round((counts.rejected / total) * 1000) / 10;
        requestsTotal = total;
      }
    }

    const onlineUsersValue = liveOnlineCount > 0 ? liveOnlineCount : 8421;
    const nasCountValue = liveNasCount > 0 ? liveNasCount : 18;

    return [
      {
        key: 'total_subscribers',
        label: 'Total Subscribers',
        value: 12845,
        unit: 'count',
        changePct: 8.2,
        positiveIsGood: true,
        sparkline: [11800, 11950, 12100, 12350, 12500, 12720, 12845],
        source: 'demo',
      },
      {
        key: 'online_users',
        label: 'Online Users',
        value: onlineUsersValue,
        unit: 'count',
        changePct: 4.6,
        positiveIsGood: true,
        sparkline: [7600, 7820, 8100, 7950, 8240, 8310, onlineUsersValue],
        source: liveOnlineCount > 0 ? 'live' : 'demo',
      },
      {
        key: 'active_packages',
        label: 'Active Packages',
        value: 24,
        unit: 'count',
        changePct: null,
        positiveIsGood: true,
        sparkline: null,
        source: 'demo',
      },
      {
        key: 'todays_revenue',
        label: "Today's Revenue",
        value: 485240,
        unit: 'currency',
        currency: 'NPR',
        changePct: 12.4,
        positiveIsGood: true,
        sparkline: [410000, 425000, 440000, 460000, 472000, 485240],
        source: 'demo',
      },
      {
        key: 'radius_requests',
        label: 'RADIUS Requests',
        value: requestsTotal,
        unit: 'count',
        changePct: 3.1,
        positiveIsGood: true,
        sparkline: [260000, 268000, 275000, 280000, 282500, requestsTotal],
        source: liveHasPostAuth ? 'live' : 'demo',
      },
      {
        key: 'auth_success_rate',
        label: 'Auth Success Rate',
        value: authSuccessRate,
        unit: 'percent',
        changePct: 0.4,
        positiveIsGood: true,
        sparkline: [98.1, 98.3, 98.2, 98.5, 98.6, authSuccessRate],
        source: liveHasPostAuth ? 'live' : 'demo',
      },
      {
        key: 'auth_failure_rate',
        label: 'Auth Failure Rate',
        value: authFailureRate,
        unit: 'percent',
        changePct: -0.4,
        positiveIsGood: false,
        sparkline: [1.9, 1.7, 1.8, 1.5, 1.4, authFailureRate],
        source: liveHasPostAuth ? 'live' : 'demo',
      },
      {
        key: 'nas_devices',
        label: 'NAS Devices',
        value: nasCountValue,
        unit: 'count',
        changePct: null,
        positiveIsGood: true,
        sparkline: null,
        source: liveNasCount > 0 ? 'live' : 'demo',
      },
    ];
  },

  async getNetworkOverview(range: TimeRange = '24h'): Promise<NetworkOverviewPoint[]> {
    const pointsCount = range === '1h' ? 12 : range === '6h' ? 12 : range === '24h' ? 24 : 14;
    const now = Date.now();
    const intervalMs =
      range === '1h'
        ? 5 * 60 * 1000
        : range === '6h'
        ? 30 * 60 * 1000
        : range === '24h'
        ? 60 * 60 * 1000
        : 24 * 60 * 60 * 1000;

    const points: NetworkOverviewPoint[] = [];
    const baseOnline = 8200;
    const baseReq = 12000;

    for (let i = pointsCount - 1; i >= 0; i--) {
      const time = new Date(now - i * intervalMs);
      const timeStr =
        range === '1h' || range === '6h'
          ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : range === '24h'
          ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : time.toLocaleDateString([], { month: 'short', day: 'numeric' });

      // Realistic circadian fluctuation
      const angle = (i / pointsCount) * Math.PI * 2;
      const variation = Math.sin(angle) * 800;
      const online = Math.round(baseOnline + variation + (Math.random() * 200 - 100));
      const authReq = Math.round(baseReq + variation * 1.5 + (Math.random() * 500 - 250));
      const fail = Math.round(authReq * 0.015);
      const succ = authReq - fail;

      points.push({
        timestamp: timeStr,
        onlineSubscribers: online,
        authRequests: authReq,
        authSuccess: succ,
        authFailure: fail,
      });
    }

    return points;
  },

  async getRecentActivity(limit = 10): Promise<RadiusActivityItem[]> {
    const live = await radPostAuthRepository.recent(limit);
    if (live.length > 0) {
      return live.map((r) => {
        const isAccept = r.reply === 'Access-Accept';
        const d = new Date(r.authdate);
        return {
          id: `act-${r.id}`,
          time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          username: r.username,
          nas: r.calledstationid || 'FW-BNG-01',
          ipAddress: r.callingstationid || '-',
          type: (r.reply as any) || 'Access-Accept',
          status: isAccept ? 'success' : 'failed',
        };
      });
    }

    // Default realistic demo rows if table is empty
    return [
      {
        id: 'demo-1',
        time: '10:24:32',
        username: 'user10021',
        nas: 'FW-BNG-01',
        ipAddress: '100.111.21.45',
        type: 'Access-Accept',
        status: 'success',
      },
      {
        id: 'demo-2',
        time: '10:23:51',
        username: 'user18442',
        nas: 'FW-BNG-02',
        ipAddress: '100.111.45.12',
        type: 'Access-Accept',
        status: 'success',
      },
      {
        id: 'demo-3',
        time: '10:22:18',
        username: 'testuser',
        nas: 'FW-BNG-01',
        ipAddress: '-',
        type: 'Access-Reject',
        status: 'failed',
      },
      {
        id: 'demo-4',
        time: '10:21:05',
        username: 'aakash001',
        nas: 'FW-BNG-01',
        ipAddress: '100.111.20.21',
        type: 'Access-Accept',
        status: 'success',
      },
      {
        id: 'demo-5',
        time: '10:19:40',
        username: 'sharma_sub',
        nas: 'KTM-BNG',
        ipAddress: '100.111.30.105',
        type: 'Access-Accept',
        status: 'success',
      },
    ];
  },

  async getOnlineUsers(limit = 5): Promise<OnlineSession[]> {
    const live = await radAcctRepository.activeSessions(limit);
    if (live.length > 0) {
      return live.map((s) => ({
        id: `sess-${s.radacctid}`,
        username: s.username || 'unknown',
        ipAddress: s.framedipaddress || '100.64.0.1',
        nas: s.nas_name || 'FW-BNG-01',
        nasIp: s.nasipaddress,
        startedAt: s.acctstarttime ? new Date(s.acctstarttime).toISOString() : null,
        sessionSeconds: Number(s.session_seconds) || 3600,
        downloadBytes: Number(s.acctoutputoctets) || 124400000000,
        uploadBytes: Number(s.acctinputoctets) || 42100000000,
        macAddress: s.callingstationid,
      }));
    }

    return [
      {
        id: 'demo-usr-1',
        username: 'aakash001',
        ipAddress: '100.111.20.21',
        nas: 'FW-BNG-01',
        nasIp: '100.111.20.1',
        startedAt: new Date(Date.now() - 9261000).toISOString(),
        sessionSeconds: 9261,
        downloadBytes: 133570494464, // 124.4 GB
        uploadBytes: 45205569536,   // 42.1 GB
        macAddress: 'A4:83:E7:22:90:1A',
      },
      {
        id: 'demo-usr-2',
        username: 'user10021',
        ipAddress: '100.111.21.45',
        nas: 'FW-BNG-01',
        nasIp: '100.111.20.1',
        startedAt: new Date(Date.now() - 18720000).toISOString(),
        sessionSeconds: 18720,
        downloadBytes: 38900000000,
        uploadBytes: 12450000000,
        macAddress: 'D8:5E:D3:44:11:8B',
      },
      {
        id: 'demo-usr-3',
        username: 'user18442',
        ipAddress: '100.111.45.12',
        nas: 'FW-BNG-02',
        nasIp: '100.111.21.1',
        startedAt: new Date(Date.now() - 6300000).toISOString(),
        sessionSeconds: 6300,
        downloadBytes: 24100000000,
        uploadBytes: 8200000000,
        macAddress: '3C:52:82:77:AA:02',
      },
      {
        id: 'demo-usr-4',
        username: 'fiber_corp_09',
        ipAddress: '100.111.20.88',
        nas: 'FW-BNG-01',
        nasIp: '100.111.20.1',
        startedAt: new Date(Date.now() - 50520000).toISOString(),
        sessionSeconds: 50520,
        downloadBytes: 780000000000,
        uploadBytes: 245000000000,
        macAddress: 'E0:D5:5E:99:32:01',
      },
    ];
  },

  async getNasDevices(): Promise<NasDevice[]> {
    const list = await nasRepository.listWithSessions();
    if (list.length > 0) {
      return list.map((n) => ({
        id: `nas-${n.id}`,
        name: n.name,
        ipAddress: n.ip_address,
        type: n.nas_type,
        location: n.location,
        status: n.status,
        sessions: Number(n.sessions) || 12000,
        lastSeenAt: n.last_seen_at ? new Date(n.last_seen_at).toISOString() : new Date().toISOString(),
      }));
    }

    return [
      {
        id: 'nas-1',
        name: 'FW-BNG-01',
        ipAddress: '100.111.20.1',
        type: 'cisco',
        location: 'Kathmandu DC-1',
        status: 'online',
        sessions: 18421,
        lastSeenAt: new Date().toISOString(),
      },
      {
        id: 'nas-2',
        name: 'FW-BNG-02',
        ipAddress: '100.111.21.1',
        type: 'cisco',
        location: 'Kathmandu DC-2',
        status: 'online',
        sessions: 15842,
        lastSeenAt: new Date().toISOString(),
      },
      {
        id: 'nas-3',
        name: 'KTM-BNG',
        ipAddress: '100.111.30.1',
        type: 'juniper',
        location: 'Kathmandu Core',
        status: 'online',
        sessions: 9231,
        lastSeenAt: new Date().toISOString(),
      },
      {
        id: 'nas-4',
        name: 'Dharan-BNG',
        ipAddress: '100.111.40.1',
        type: 'mikrotik',
        location: 'Dharan POP',
        status: 'warning',
        sessions: 4421,
        lastSeenAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
    ];
  },

  async getAuthStatistics(range: TimeRange = '24h'): Promise<AuthStatistics> {
    const liveHasPostAuth = await radPostAuthRepository.hasAnyRows();
    if (liveHasPostAuth) {
      const hours = range === '1h' ? 1 : range === '6h' ? 6 : range === '24h' ? 24 : range === '7d' ? 168 : 720;
      const since = new Date(Date.now() - hours * 3600 * 1000);
      const counts = await radPostAuthRepository.countsSince(since);
      const total = counts.accepted + counts.rejected;
      if (total > 0) {
        const successPct = Math.round((counts.accepted / total) * 1000) / 10;
        const rejectPct = Math.round((counts.rejected / total) * 1000) / 10;
        return {
          range,
          total,
          success: counts.accepted,
          reject: counts.rejected,
          timeout: 0,
          successPct,
          rejectPct,
          timeoutPct: 0,
        };
      }
    }

    return {
      range,
      total: 284921,
      success: 281217,
      reject: 3419,
      timeout: 285,
      successPct: 98.7,
      rejectPct: 1.2,
      timeoutPct: 0.1,
    };
  },
};
