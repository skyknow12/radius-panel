'use client';

import React from 'react';
import { CreditCard, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import type { PaymentMethodItem } from '@/types/api';

export function PaymentMethodsView() {
  const [methods, setMethods] = React.useState<PaymentMethodItem[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);

  const fetchMethods = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/billing/payment-methods');
      if (res.ok) {
        const json = await res.json();
        setMethods(json.data || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  const handleToggle = async (id: number, currentStatus: boolean) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('radius_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/billing/payment-methods/${id}/toggle`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_active: !currentStatus }),
      });
      if (res.ok) {
        fetchMethods();
      }
    } catch {}
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-500" />
            Configured Payment Channels & Methods
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage supported payment gateways and channels for counter, mobile, and digital subscriber recharges.
          </p>
        </div>
      </div>

      {/* Methods Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
              <th className="py-3 px-4">Code</th>
              <th className="py-3 px-4">Channel Name</th>
              <th className="py-3 px-4">Reference Required</th>
              <th className="py-3 px-4">Description</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Toggle Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-muted-foreground">
                  Loading payment channels...
                </td>
              </tr>
            ) : methods.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-muted-foreground">
                  No payment methods configured.
                </td>
              </tr>
            ) : (
              methods.map((m) => (
                <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-foreground">
                    {m.code}
                  </td>
                  <td className="py-3 px-4 font-semibold text-foreground">
                    {m.name}
                  </td>
                  <td className="py-3 px-4">
                    {m.requires_reference ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-500">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Required (Voucher/TxID)
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Optional</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    {m.description || '—'}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        m.is_active
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {m.is_active ? 'ACTIVE' : 'DISABLED'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleToggle(m.id, m.is_active)}
                      className={`px-3 py-1 rounded-xl font-bold text-[11px] transition-colors ${
                        m.is_active
                          ? 'bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500/20'
                          : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20'
                      }`}
                    >
                      {m.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
