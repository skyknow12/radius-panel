'use client';

import React from 'react';
import {
  Clock,
  AlertTriangle,
  Calendar,
  Search,
  Zap,
  CheckCircle2,
  XCircle,
  PlusCircle,
  CreditCard,
} from 'lucide-react';
import type { SubscriberItem, PackageItem } from '@/types/api';
import { RechargeModal } from './recharge-modal';

interface BillingExpiryViewProps {
  onViewSubscriber?: (username: string) => void;
  initialFilter?: string;
}

export function BillingExpiryView({
  onViewSubscriber,
  initialFilter = 'today',
}: BillingExpiryViewProps) {
  const [filter, setFilter] = React.useState<string>(initialFilter);
  const [search, setSearch] = React.useState<string>('');
  const [items, setItems] = React.useState<any[]>([]);
  const [total, setTotal] = React.useState<number>(0);
  const [loading, setLoading] = React.useState<boolean>(true);

  // Recharge modal for selected subscriber
  const [rechargeSub, setRechargeSub] = React.useState<any | null>(null);

  const fetchExpiring = React.useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('filter', filter);
      if (search.trim()) params.set('search', search.trim());
      params.set('limit', '50');

      const res = await fetch(`/api/billing/expiry?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setItems(json.data.items || []);
        setTotal(json.data.total || 0);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [filter, search]);

  React.useEffect(() => {
    fetchExpiring();
  }, [fetchExpiring]);

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Clock className="w-5 h-5 text-rose-500" />
            Subscriber Expiry & Renewal Management
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor upcoming and expired subscriber service cycles. Execute instant renewals before disconnection.
          </p>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 rounded-2xl bg-card border border-border">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {[
            { id: 'today', label: 'Expiring Today' },
            { id: 'tomorrow', label: 'Expiring Tomorrow' },
            { id: '3days', label: 'In 3 Days' },
            { id: '7days', label: 'In 7 Days' },
            { id: 'expired', label: 'Already Expired' },
            { id: 'all', label: 'All Lifecycle' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                filter === tab.id
                  ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search username, CID, full name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-muted/50 border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
          />
        </div>
      </div>

      {/* Expiry Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
                <th className="py-3 px-3.5">Subscriber</th>
                <th className="py-3 px-3.5">Contact / Phone</th>
                <th className="py-3 px-3.5">Current Package</th>
                <th className="py-3 px-3.5">Package Speed</th>
                <th className="py-3 px-3.5">Service Expiry</th>
                <th className="py-3 px-3.5 text-center">Status</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Checking subscriber expiry timelines...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    No subscribers found matching this expiry window.
                  </td>
                </tr>
              ) : (
                items.map((sub) => {
                  const now = new Date();
                  const expDate = sub.expiry_date ? new Date(sub.expiry_date) : null;
                  const isExpired = expDate ? expDate < now : false;

                  return (
                    <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3.5">
                        <button
                          onClick={() => onViewSubscriber?.(sub.username)}
                          className="font-bold text-foreground hover:text-primary transition-colors text-left"
                        >
                          {sub.username}
                        </button>
                        <div className="text-[11px] text-muted-foreground">
                          {sub.full_name} • <span className="font-mono">CID: {sub.customer_id}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3.5 font-mono text-muted-foreground">
                        {sub.phone || '—'}
                      </td>
                      <td className="py-3 px-3.5 font-medium text-foreground">
                        {sub.package_name || 'No Plan'}
                      </td>
                      <td className="py-3 px-3.5 text-muted-foreground font-mono">
                        {sub.download_speed_mbps ? `${sub.download_speed_mbps}M / ${sub.upload_speed_mbps}M` : '—'}
                      </td>
                      <td className="py-3 px-3.5 font-mono">
                        {expDate ? (
                          <div className={isExpired ? 'text-rose-500 font-bold' : 'text-amber-500 font-medium'}>
                            {expDate.toLocaleDateString([], {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                            <span className="block text-[10px] opacity-80">
                              {isExpired ? 'Expired' : 'Active until end of day'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No Expiry</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            sub.status === 'active' && !isExpired
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                          }`}
                        >
                          {isExpired ? 'EXPIRED' : sub.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <button
                          onClick={() => setRechargeSub(sub)}
                          className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs transition-all shadow-sm flex items-center gap-1.5 ml-auto"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Recharge</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Embedded Recharge Modal */}
      {rechargeSub && (
        <RechargeModal
          isOpen={rechargeSub !== null}
          onClose={() => setRechargeSub(null)}
          subscriber={rechargeSub}
          onRechargeSuccess={() => {
            fetchExpiring();
            setRechargeSub(null);
          }}
        />
      )}
    </div>
  );
}
