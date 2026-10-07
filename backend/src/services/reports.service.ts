import { query } from '../db/pool';

export const reportsService = {
  async getSummary(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 86400000);
    const end = endDate ? new Date(endDate) : new Date();

    const [subCount, rechargeSum, authStats, trafficSum] = await Promise.all([
      query<{ count: string }>(`SELECT count(*) as count FROM subscribers WHERE created_at BETWEEN $1 AND $2`, [start, end]),
      query<{ total: string; count: string }>(
        `SELECT COALESCE(sum(amount), 0) as total, count(*) as count FROM recharge_transactions WHERE recharge_date BETWEEN $1 AND $2`,
        [start, end],
      ),
      query<{ reply: string; count: string }>(
        `SELECT reply, count(*) as count FROM radpostauth WHERE authdate BETWEEN $1 AND $2 GROUP BY reply`,
        [start, end],
      ),
      query<{ in_bytes: string; out_bytes: string }>(
        `SELECT COALESCE(sum(acctinputoctets), 0) as in_bytes, COALESCE(sum(acctoutputoctets), 0) as out_bytes FROM radacct WHERE acctstarttime BETWEEN $1 AND $2`,
        [start, end],
      ),
    ]);

    let authAccept = 0;
    let authReject = 0;
    for (const a of authStats.rows) {
      if (a.reply === 'Access-Accept') authAccept += parseInt(a.count, 10);
      else if (a.reply === 'Access-Reject') authReject += parseInt(a.count, 10);
    }

    const inBytes = parseInt(trafficSum.rows[0]?.in_bytes || '0', 10);
    const outBytes = parseInt(trafficSum.rows[0]?.out_bytes || '0', 10);

    return {
      period: { start, end },
      newSubscribers: parseInt(subCount.rows[0]?.count || '0', 10),
      totalRechargeAmount: parseFloat(rechargeSum.rows[0]?.total || '0'),
      rechargeCount: parseInt(rechargeSum.rows[0]?.count || '0', 10),
      authAccept,
      authReject,
      totalTrafficBytes: inBytes + outBytes,
      totalTrafficGB: ((inBytes + outBytes) / (1024 * 1024 * 1024)).toFixed(2),
    };
  },

  async exportReportCsv(type: string, startDate?: string, endDate?: string): Promise<string> {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 86400000);
    const end = endDate ? new Date(endDate) : new Date();

    if (type === 'recharge') {
      const { rows } = await query<any>(
        `SELECT rt.receipt_no, s.customer_id, s.username, s.full_name,
                p.name as package_name, rt.duration_months, rt.amount, rt.currency,
                rt.payment_method, rt.recharge_date, rt.new_expiry, rt.created_by
           FROM recharge_transactions rt
           JOIN subscribers s ON s.id = rt.subscriber_id
           JOIN packages p ON p.id = rt.package_id
          WHERE rt.recharge_date BETWEEN $1 AND $2
          ORDER BY rt.recharge_date DESC`,
        [start, end],
      );
      const headers = ['Receipt No', 'Customer ID', 'Username', 'Full Name', 'Package', 'Duration (Months)', 'Amount', 'Currency', 'Payment Method', 'Recharge Date', 'New Expiry', 'Operator'];
      const lines = [headers.join(',')];
      for (const r of rows) {
        lines.push([
          `"${r.receipt_no}"`,
          `"${r.customer_id}"`,
          `"${r.username}"`,
          `"${(r.full_name || '').replace(/"/g, '""')}"`,
          `"${r.package_name}"`,
          r.duration_months,
          r.amount,
          r.currency,
          `"${r.payment_method}"`,
          `"${new Date(r.recharge_date).toISOString()}"`,
          `"${new Date(r.new_expiry).toISOString()}"`,
          `"${r.created_by}"`,
        ].join(','));
      }
      return lines.join('\n');
    }

    if (type === 'accounting') {
      const { rows } = await query<any>(
        `SELECT username, acctsessionid, nasipaddress, framedipaddress,
                acctstarttime, acctstoptime, acctsessiontime,
                round(acctinputoctets / (1024.0*1024.0), 2) as input_mb,
                round(acctoutputoctets / (1024.0*1024.0), 2) as output_mb,
                acctterminatecause
           FROM radacct
          WHERE acctstarttime BETWEEN $1 AND $2
          ORDER BY acctstarttime DESC
          LIMIT 1000`,
        [start, end],
      );
      const headers = ['Username', 'Session ID', 'NAS IP', 'Framed IP', 'Start Time', 'Stop Time', 'Duration (sec)', 'Download (MB)', 'Upload (MB)', 'Terminate Cause'];
      const lines = [headers.join(',')];
      for (const r of rows) {
        lines.push([
          `"${r.username}"`,
          `"${r.acctsessionid}"`,
          `"${r.nasipaddress}"`,
          `"${r.framedipaddress}"`,
          `"${r.acctstarttime ? new Date(r.acctstarttime).toISOString() : ''}"`,
          `"${r.acctstoptime ? new Date(r.acctstoptime).toISOString() : 'Active'}"`,
          r.acctsessiontime || 0,
          r.input_mb || 0,
          r.output_mb || 0,
          `"${r.acctterminatecause || ''}"`,
        ].join(','));
      }
      return lines.join('\n');
    }

    // Default: subscribers
    const { rows } = await query<any>(
      `SELECT customer_id, username, full_name, status, connection_type, phone, email, created_at
         FROM subscribers
        WHERE created_at BETWEEN $1 AND $2
        ORDER BY created_at DESC`,
      [start, end],
    );
    const headers = ['Customer ID', 'Username', 'Full Name', 'Status', 'Connection Type', 'Phone', 'Email', 'Created Date'];
    const lines = [headers.join(',')];
    for (const r of rows) {
      lines.push([
        `"${r.customer_id}"`,
        `"${r.username}"`,
        `"${(r.full_name || '').replace(/"/g, '""')}"`,
        r.status,
        r.connection_type,
        `"${r.phone || ''}"`,
        `"${r.email || ''}"`,
        `"${new Date(r.created_at).toISOString()}"`,
      ].join(','));
    }
    return lines.join('\n');
  },
};
