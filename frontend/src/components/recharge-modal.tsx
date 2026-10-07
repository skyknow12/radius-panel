'use client';

import React from 'react';
import { CreditCard, Calendar, CheckCircle2, AlertCircle, Clock, Zap, DollarSign } from 'lucide-react';
import type { PackageItem, PackagePriceItem } from '@/types/api';

interface RechargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriber: {
    id: number;
    username: string;
    customer_id: string;
    full_name: string;
    current_package_id?: number | null;
    package_name?: string | null;
    expiry_date?: string | null;
  } | null;
  packages: PackageItem[];
  onRechargeSuccess: () => void;
}

export function RechargeModal({
  isOpen,
  onClose,
  subscriber,
  packages,
  onRechargeSuccess,
}: RechargeModalProps) {
  const [selectedPackageId, setSelectedPackageId] = React.useState<number>(1);
  const [durationMonths, setDurationMonths] = React.useState<number>(1);
  const [prices, setPrices] = React.useState<PackagePriceItem[]>([]);
  const [amount, setAmount] = React.useState<number>(1000);
  const [currency, setCurrency] = React.useState<string>('NPR');
  const [paymentMethod, setPaymentMethod] = React.useState<string>('Cash');
  const [notes, setNotes] = React.useState<string>('');
  const [submitting, setSubmitting] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  // Initialize selected package
  React.useEffect(() => {
    if (subscriber?.current_package_id) {
      setSelectedPackageId(subscriber.current_package_id);
    } else if (packages.length > 0) {
      setSelectedPackageId(packages[0].id);
    }
  }, [subscriber, packages]);

  // Fetch package multi-duration prices whenever selected package changes
  React.useEffect(() => {
    if (!selectedPackageId) return;
    const fetchPrices = async () => {
      try {
        const res = await fetch(`/api/packages/${selectedPackageId}/prices`);
        if (res.ok) {
          const json = await res.json();
          const list: PackagePriceItem[] = json.data || [];
          setPrices(list);

          // Find price for current selected duration
          const found = list.find((p) => p.duration_months === durationMonths);
          if (found) {
            setAmount(Number(found.price));
            setCurrency(found.currency || 'NPR');
          } else {
            const pkg = packages.find((p) => p.id === selectedPackageId);
            if (pkg) {
              setAmount(Number(pkg.price) * durationMonths);
              setCurrency(pkg.currency || 'NPR');
            }
          }
        }
      } catch {}
    };
    fetchPrices();
  }, [selectedPackageId, durationMonths, packages]);

  if (!isOpen || !subscriber) return null;

  // Calculate new expiry date preview
  const currentExpiry = subscriber.expiry_date ? new Date(subscriber.expiry_date) : null;
  const now = new Date();
  const baseDate = currentExpiry && currentExpiry > now ? currentExpiry : now;
  const calculatedExpiry = new Date(baseDate);
  calculatedExpiry.setMonth(calculatedExpiry.getMonth() + durationMonths);

  const handleDurationSelect = (months: number) => {
    setDurationMonths(months);
    const found = prices.find((p) => p.duration_months === months);
    if (found) {
      setAmount(Number(found.price));
      setCurrency(found.currency || 'NPR');
    } else {
      const pkg = packages.find((p) => p.id === selectedPackageId);
      if (pkg) {
        setAmount(Number(pkg.price) * months);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      setSubmitting(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('radius_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/recharge', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          subscriber_id: subscriber.id,
          package_id: selectedPackageId,
          duration_months: durationMonths,
          amount: Number(amount),
          currency,
          payment_method: paymentMethod,
          notes: notes.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || json.message || 'Recharge failed');
      }

      onRechargeSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error processing recharge');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Recharge Subscriber: {subscriber.username}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                CID: {subscriber.customer_id} • {subscriber.full_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm p-1.5 rounded-lg hover:bg-muted"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* Select Package */}
          <div>
            <label className="block font-medium text-foreground mb-1">
              Select Service Package *
            </label>
            <select
              value={selectedPackageId}
              onChange={(e) => setSelectedPackageId(Number(e.target.value))}
              className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary font-medium"
            >
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} ({pkg.download_speed_mbps}M/{pkg.upload_speed_mbps}M) — {pkg.currency} {pkg.price}/mo
                </option>
              ))}
            </select>
          </div>

          {/* Select Duration (1, 3, 6, 12 Months) */}
          <div>
            <label className="block font-medium text-foreground mb-1.5">
              Recharge Duration *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { months: 1, label: '1 Month' },
                { months: 3, label: '3 Months' },
                { months: 6, label: '6 Months' },
                { months: 12, label: '12 Months' },
              ].map(({ months, label }) => {
                const priceObj = prices.find((p) => p.duration_months === months);
                const isSelected = durationMonths === months;
                return (
                  <button
                    key={months}
                    type="button"
                    onClick={() => handleDurationSelect(months)}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                        : 'border-border bg-card/60 hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="text-xs">{label}</div>
                    <div className="text-[10px] font-mono mt-0.5 opacity-90">
                      {priceObj ? `${currency} ${priceObj.price}` : 'Select'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount & Payment Method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-foreground mb-1">
                Amount ({currency}) *
              </label>
              <div className="relative">
                <DollarSign className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-muted/50 border border-border rounded-xl pl-8 pr-3 py-2 text-foreground font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-foreground mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              >
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer / QR</option>
                <option value="Online Gateway">eSewa / Khalti</option>
                <option value="Cheque">Cheque</option>
                <option value="Complimentary">Complimentary / Staff</option>
              </select>
            </div>
          </div>

          {/* Expiry Calculation Preview Card */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                Current Expiry:
              </span>
              <span className="font-mono text-foreground font-medium">
                {subscriber.expiry_date
                  ? new Date(subscriber.expiry_date).toLocaleDateString([], {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'No active expiry'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-500 font-semibold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                New Expiry (+{durationMonths} Months):
              </span>
              <span className="font-mono text-emerald-500 font-bold">
                {calculatedExpiry.toLocaleDateString([], {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>

          {/* Staff Notes */}
          <div>
            <label className="block font-medium text-foreground mb-1">
              Receipt / Transaction Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Counter deposit, TxID: 98129841"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-border flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-md shadow-primary/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'Processing...' : `Confirm Recharge (${currency} ${amount.toLocaleString()})`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
