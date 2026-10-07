import { query } from '../db/pool';

export interface GlobalSearchResultItem {
  type: 'subscriber' | 'session' | 'nas' | 'package' | 'ip' | 'transaction' | 'invoice' | 'branch' | 'reseller' | 'wallet';
  title: string;
  subtitle: string;
  id: string | number;
  badge?: string;
  url?: string;
}

export const searchService = {
  async search(searchTerm: string): Promise<GlobalSearchResultItem[]> {
    const q = searchTerm.trim();
    if (!q || q.length < 2) return [];

    const results: GlobalSearchResultItem[] = [];
    const pattern = `%${q}%`;

    // 1. Subscribers
    const subRes = await query<{ id: number; username: string; full_name: string; customer_id: string; status: string; static_ip: string | null }>(
      `SELECT id, username, full_name, customer_id, status, host(static_ip) as static_ip
         FROM subscribers
        WHERE username ILIKE $1 OR full_name ILIKE $1 OR customer_id ILIKE $1 OR phone ILIKE $1 OR host(static_ip) ILIKE $1
        LIMIT 6`,
      [pattern],
    );
    for (const s of subRes.rows) {
      results.push({
        type: 'subscriber',
        id: s.id,
        title: `${s.username} (${s.full_name})`,
        subtitle: `CID: ${s.customer_id} • IP: ${s.static_ip || 'Dynamic'}`,
        badge: s.status,
      });
    }

    // 2. Branches
    const brRes = await query<{ id: number; name: string; code: string; status: string }>(
      `SELECT id, name, code, status FROM branches WHERE name ILIKE $1 OR code ILIKE $1 LIMIT 3`,
      [pattern],
    );
    for (const b of brRes.rows) {
      results.push({
        type: 'branch',
        id: b.id,
        title: `Branch: ${b.name}`,
        subtitle: `Code: ${b.code}`,
        badge: b.status,
      });
    }

    // 3. Resellers
    const resRes = await query<{ id: number; name: string; code: string; contact_person: string; status: string }>(
      `SELECT id, name, code, contact_person, status FROM resellers WHERE name ILIKE $1 OR code ILIKE $1 OR contact_person ILIKE $1 LIMIT 3`,
      [pattern],
    );
    for (const r of resRes.rows) {
      results.push({
        type: 'reseller',
        id: r.id,
        title: `Reseller: ${r.name}`,
        subtitle: `Code: ${r.code} • Contact: ${r.contact_person || 'N/A'}`,
        badge: r.status,
      });
    }

    // 4. Wallets
    const wltRes = await query<{ id: number; wallet_number: string; entity_type: string; balance: string }>(
      `SELECT id, wallet_number, entity_type, balance FROM wallets WHERE wallet_number ILIKE $1 LIMIT 3`,
      [pattern],
    );
    for (const w of wltRes.rows) {
      results.push({
        type: 'wallet',
        id: w.id,
        title: `Wallet: ${w.wallet_number}`,
        subtitle: `${w.entity_type.toUpperCase()} • Balance: NPR ${w.balance}`,
      });
    }

    // 5. Active Sessions
    const sessRes = await query<{ radacctid: number; username: string; framedipaddress: string; acctsessionid: string; nasipaddress: string }>(
      `SELECT radacctid, username, host(framedipaddress) as framedipaddress, acctsessionid, host(nasipaddress) as nasipaddress
         FROM radacct
        WHERE acctstoptime IS NULL AND (username ILIKE $1 OR host(framedipaddress) ILIKE $1 OR acctsessionid ILIKE $1)
        LIMIT 4`,
      [pattern],
    );
    for (const sess of sessRes.rows) {
      results.push({
        type: 'session',
        id: sess.radacctid,
        title: `Session: ${sess.username}`,
        subtitle: `IP: ${sess.framedipaddress} • NAS: ${sess.nasipaddress} • SID: ${sess.acctsessionid}`,
        badge: 'online',
      });
    }

    // 6. NAS Devices
    const nasRes = await query<{ id: number; name: string; ip_address: string; nas_type: string; status: string }>(
      `SELECT id, name, host(ip_address) as ip_address, nas_type, status
         FROM nas_devices
        WHERE name ILIKE $1 OR host(ip_address) ILIKE $1
        LIMIT 3`,
      [pattern],
    );
    for (const n of nasRes.rows) {
      results.push({
        type: 'nas',
        id: n.id,
        title: `NAS: ${n.name}`,
        subtitle: `${n.ip_address} • Type: ${n.nas_type}`,
        badge: n.status,
      });
    }

    // 7. Packages
    const pkgRes = await query<{ id: number; name: string; rate_limit: string; price: string }>(
      `SELECT id, name, rate_limit, price
         FROM packages
        WHERE name ILIKE $1
        LIMIT 3`,
      [pattern],
    );
    for (const p of pkgRes.rows) {
      results.push({
        type: 'package',
        id: p.id,
        title: `Package: ${p.name}`,
        subtitle: `Rate: ${p.rate_limit} • NPR ${p.price}`,
      });
    }

    // 8. Billing Transactions
    const txRes = await query<{ transaction_id: string; username: string; final_amount: string; currency: string; status: string; package_name: string }>(
      `SELECT transaction_id, username, final_amount, currency, status, package_name
         FROM recharge_transactions
        WHERE transaction_id ILIKE $1 OR payment_reference ILIKE $1 OR receipt_no ILIKE $1
        LIMIT 4`,
      [pattern],
    );
    for (const tx of txRes.rows) {
      results.push({
        type: 'transaction',
        id: tx.transaction_id,
        title: `Txn: ${tx.transaction_id}`,
        subtitle: `${tx.username} • ${tx.currency} ${tx.final_amount} (${tx.package_name})`,
        badge: tx.status,
      });
    }

    return results;
  },
};
