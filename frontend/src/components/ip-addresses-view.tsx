'use client';

import React from 'react';
import {
  Server,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Layers,
} from 'lucide-react';
import type { IpAddressItem, IpPoolItem } from '@/types/api';

export function IpAddressesView() {
  const [addresses, setAddresses] = React.useState<IpAddressItem[]>([]);
  const [pools, setPools] = React.useState<IpPoolItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [poolFilter, setPoolFilter] = React.useState<string>('all');

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (poolFilter !== 'all') params.set('pool_id', poolFilter);

      const [addrRes, poolRes] = await Promise.all([
        fetch(`/api/ip-addresses?${params.toString()}`),
        fetch('/api/ip-pools'),
      ]);

      if (addrRes.ok) {
        const json = await addrRes.json();
        setAddresses(json.data || []);
      }
      if (poolRes.ok) {
        const json = await poolRes.json();
        setPools(json.data || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [search, statusFilter, poolFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'assigned':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Assigned
          </span>
        );
      case 'reserved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" /> Reserved
          </span>
        );
      case 'blocked':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <XCircle className="w-3 h-3" /> Blocked
          </span>
        );
      case 'available':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
            Available
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">IP Allocations</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              {addresses.length} Addresses
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Static and dynamic IPv4 allocation inventory linked to active subscribers.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="p-2 rounded-xl border border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by IP, username, CID, or subscriber name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-card border border-border text-xs focus:ring-2 focus:ring-primary outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-card border border-border text-xs font-medium text-foreground outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="assigned">Assigned</option>
            <option value="reserved">Reserved</option>
            <option value="available">Available</option>
            <option value="blocked">Blocked</option>
          </select>

          {/* Pool Filter */}
          <select
            value={poolFilter}
            onChange={(e) => setPoolFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-card border border-border text-xs font-medium text-foreground outline-none"
          >
            <option value="all">All Pools</option>
            {pools.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Addresses Table */}
      <div className="border border-border rounded-2xl bg-card/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Pool Name</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Subscriber</th>
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4">Allocation Date</th>
                <th className="py-3 px-4">Last Seen</th>
                <th className="py-3 px-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    Loading IP addresses...
                  </td>
                </tr>
              ) : addresses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    No matching IP records found.
                  </td>
                </tr>
              ) : (
                addresses.map((a) => (
                  <tr key={a.id} className="hover:bg-accent/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-foreground">
                      {a.ip_address}
                    </td>
                    <td className="py-3 px-4 font-mono text-muted-foreground">
                      {a.pool_name || 'Static Assignment'}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(a.status)}</td>
                    <td className="py-3 px-4">
                      {a.subscriber_name ? (
                        <div>
                          <span className="font-semibold text-foreground">{a.subscriber_name}</span>
                          <span className="block text-[10px] font-mono text-muted-foreground">
                            {a.customer_id}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-primary font-medium">
                      {a.username || '—'}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {a.allocation_date ? new Date(a.allocation_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {a.last_seen ? new Date(a.last_seen).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground line-clamp-1">
                      {a.notes || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
