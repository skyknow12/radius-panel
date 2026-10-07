'use client';

import React from 'react';
import {
  CreditCard,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  Percent,
  Tag,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import type { PackageItem, PackagePriceItem, PaymentMethodItem } from '@/types/api';

interface RechargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriber?: {
    id: number;
    username: string;
    customer_id?: string;
    full_name?: string;
    current_package_id?: number | null;
    package_name?: string | null;
    expiry_date?: string | null;
  } | null;
  subscriberId?: number;
  username?: string;
  currentPackageId?: number | null;
  packages?: PackageItem[];
  onRechargeSuccess?: () => void;
  onSuccess?: () => void;
}

export function RechargeModal({
  isOpen,
  onClose,
  subscriber,
  subscriberId,
  username,
  currentPackageId,
  packages = [],
  onRechargeSuccess,
  onSuccess,
}: RechargeModalProps) {
  const activeSub = subscriber || (subscriberId ? {
    id: subscriberId,
    username: username || '',
    customer_id: String(subscriberId),
    full_name: username || '',
    current_package_id: currentPackageId,
    package_name: null,
    expiry_date: null,
  } : null);

  const [localPackages, setLocalPackages] = React.useState<PackageItem[]>(packages);
  const [selectedPackageId, setSelectedPackageId] = React.useState<number>(1);
  const [durationMonths, setDurationMonths] = React.useState<number>(1);
  const [isCustomDuration, setIsCustomDuration] = React.useState<boolean>(false);
  const [customMonthsInput, setCustomMonthsInput] = React.useState<string>('2');
  const [prices, setPrices] = React.useState<PackagePriceItem[]>([]);
  const [basePrice, setBasePrice] = React.useState<number>(1000);
  const [currency, setCurrency] = React.useState<string>('NPR');

  // Discount state
  const [discountType, setDiscountType] = React.useState<'none' | 'fixed' | 'percentage'>('none');
  const [discountValue, setDiscountValue] = React.useState<number>(0);

  // Payment methods & reference
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethodItem[]>([]);
  const [selectedMethod, setSelectedMethod] = React.useState<string>('Cash');
  const [paymentReference, setPaymentReference] = React.useState<string>('');
  const [notes, setNotes] = React.useState<string>('');

  const [submitting, setSubmitting] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  // Idempotency key per modal session
  const [idempotencyKey, setIdempotencyKey] = React.useState<string>('');

  React.useEffect(() => {
    if (isOpen) {
      setIdempotencyKey(`IDEMP-${Date.now()}-${Math.floor(Math.random() * 100000)}`);
      setError(null);
    }
  }, [isOpen]);

  // Sync or fetch packages
  React.useEffect(() => {
    if (packages && packages.length > 0) {
      setLocalPackages(packages);
    } else {
      fetch('/api/packages')
        .then((res) => res.json())
        .then((json) => {
          if (json.data && Array.isArray(json.data)) {
            setLocalPackages(json.data);
          }
        })
        .catch(() => {});
    }
  }, [packages]);

  // Fetch payment methods
  React.useEffect(() => {
    fetch('/api/billing/payment-methods?active_only=true')
      .then((res) => res.json())
      .then((json) => {
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          setPaymentMethods(json.data);
          setSelectedMethod(json.data[0].name);
        } else {
          setPaymentMethods([
            { id: 1, code: 'CASH', name: 'Cash', requires_reference: false, is_active: true, sort_order: 1, description: null, created_at: '' },
            { id: 2, code: 'BANK_TRANSFER', name: 'Bank Transfer', requires_reference: true, is_active: true, sort_order: 2, description: null, created_at: '' },
            { id: 3, code: 'QR', name: 'QR Payment', requires_reference: true, is_active: true, sort_order: 3, description: null, created_at: '' },
          ]);
        }
      })
      .catch(() => {});
  }, []);

  // Initialize selected package
  React.useEffect(() => {
    if (activeSub?.current_package_id) {
      setSelectedPackageId(activeSub.current_package_id);
    } else if (localPackages.length > 0) {
      setSelectedPackageId(localPackages[0].id);
    }
  }, [activeSub, localPackages]);

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
            setBasePrice(Number(found.price));
            setCurrency(found.currency || 'NPR');
          } else {
            const pkg = localPackages.find((p) => p.id === selectedPackageId);
            if (pkg) {
              setBasePrice(Number(pkg.price) * durationMonths);
              setCurrency(pkg.currency || 'NPR');
            }
          }
        }
      } catch {}
    };
    fetchPrices();
  }, [selectedPackageId, durationMonths, localPackages]);

  if (!isOpen || !activeSub) return null;

  // Calculate discount amount & net amount
  let discountAmount = 0;
  if (discountType === 'percentage') {
    discountAmount = Math.round((basePrice * Math.min(100, Math.max(0, discountValue))) / 100 * 100) / 100;
  } else if (discountType === 'fixed') {
    discountAmount = Math.min(basePrice, Math.max(0, discountValue));
  }
  const netAmount = Math.max(0, Math.round((basePrice - discountAmount) * 100) / 100);

  // Calculate new expiry date preview
  const now = new Date();
  const currentExpiry = activeSub.expiry_date ? new Date(activeSub.expiry_date) : null;
  const isCurrentlyActive = currentExpiry && currentExpiry > now;
  const baseDate = isCurrentlyActive ? currentExpiry : now;
  const calculatedExpiry = new Date(baseDate);
  calculatedExpiry.setMonth(calculatedExpiry.getMonth() + durationMonths);

  const handleDurationSelect = (months: number) => {
    setIsCustomDuration(false);
    setDurationMonths(months);
    const found = prices.find((p) => p.duration_months === months);
    if (found) {
      setBasePrice(Number(found.price));
      setCurrency(found.currency || 'NPR');
    } else {
      const pkg = localPackages.find((p) => p.id === selectedPackageId);
      if (pkg) {
        setBasePrice(Number(pkg.price) * months);
      }
    }
  };

  const handleCustomDurationChange = (val: string) => {
    setCustomMonthsInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setDurationMonths(parsed);
      const pkg = localPackages.find((p) => p.id === selectedPackageId);
      if (pkg) {
        setBasePrice(Number(pkg.price) * parsed);
      }
    }
  };

  const currentMethodObj = paymentMethods.find((m) => m.name === selectedMethod);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (currentMethodObj?.requires_reference && !paymentReference.trim()) {
      setError(`Payment reference / transaction ID is required for ${selectedMethod}`);
      return;
    }

    try {
      setSubmitting(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('radius_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/billing/recharge', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          subscriber_id: activeSub.id,
          package_id: selectedPackageId,
          duration_months: durationMonths,
          original_price: basePrice,
          discount_type: discountType,
          discount_value: discountValue,
          payment_method: selectedMethod,
          payment_reference: paymentReference.trim() || undefined,
          notes: notes.trim() || undefined,
          idempotency_key: idempotencyKey,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || json.message || 'Recharge failed');
      }

      if (onRechargeSuccess) onRechargeSuccess();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error processing recharge');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Recharge Subscriber: {activeSub.username}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                CID: {activeSub.customer_id || activeSub.id} {activeSub.full_name ? `• ${activeSub.full_name}` : ''}
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs overflow-y-auto flex-1 pr-1">
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
              {localPackages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} ({pkg.download_speed_mbps}M/{pkg.upload_speed_mbps}M) — {pkg.currency} {pkg.price}/mo
                </option>
              ))}
            </select>
          </div>

          {/* Select Duration */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-medium text-foreground">
                Recharge Duration *
              </label>
              <button
                type="button"
                onClick={() => setIsCustomDuration(!isCustomDuration)}
                className="text-[11px] text-primary hover:underline font-medium"
              >
                {isCustomDuration ? 'Standard Durations' : '+ Custom Duration'}
              </button>
            </div>

            {!isCustomDuration ? (
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
            ) : (
              <div className="flex items-center gap-2 p-2.5 rounded-xl border border-primary/30 bg-primary/5">
                <span className="text-xs font-semibold text-foreground">Custom Months:</span>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={customMonthsInput}
                  onChange={(e) => handleCustomDurationChange(e.target.value)}
                  className="w-24 bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-muted-foreground text-[11px]">
                  ({durationMonths} Month{durationMonths > 1 ? 's' : ''})
                </span>
              </div>
            )}
          </div>

          {/* Discount Section */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-primary" /> Optional Discount
              </span>
              <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => { setDiscountType('none'); setDiscountValue(0); }}
                  className={`px-2 py-0.5 rounded ${discountType === 'none' ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground'}`}
                >
                  None
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType('fixed')}
                  className={`px-2 py-0.5 rounded ${discountType === 'fixed' ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground'}`}
                >
                  Fixed (Rs.)
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType('percentage')}
                  className={`px-2 py-0.5 rounded ${discountType === 'percentage' ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground'}`}
                >
                  Percent (%)
                </button>
              </div>
            </div>

            {discountType !== 'none' && (
              <div className="flex items-center gap-3 pt-1">
                <div className="flex-1">
                  <label className="block text-[10px] text-muted-foreground mb-1 font-medium">
                    {discountType === 'percentage' ? 'Discount Percentage (e.g. 5, 10)' : 'Discount Amount in NPR'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={discountType === 'percentage' ? 100 : basePrice}
                    step={discountType === 'percentage' ? '0.1' : '1'}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    className="w-full bg-card border border-border rounded-xl px-3 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="text-right">
                  <span className="block text-[10px] text-muted-foreground">Savings</span>
                  <span className="font-mono text-emerald-500 font-bold text-xs">
                    - {currency} {discountAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Payment Method & Reference */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-foreground mb-1">
                Payment Method *
              </label>
              <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary font-medium"
              >
                {paymentMethods.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-foreground mb-1">
                Transaction / Slip Reference {currentMethodObj?.requires_reference ? '*' : '(Optional)'}
              </label>
              <input
                type="text"
                placeholder={currentMethodObj?.requires_reference ? 'Required, e.g. Fonepay ID' : 'Receipt / voucher ref'}
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary font-mono text-xs"
              />
            </div>
          </div>

          {/* Financial Summary & Expiry Preview */}
          <div className="p-3 rounded-xl bg-card border border-border space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Base Package Price:</span>
              <span className="font-mono text-foreground font-medium">
                {currency} {basePrice.toLocaleString()}
              </span>
            </div>

            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-xs text-emerald-500">
                <span>Discount Applied:</span>
                <span className="font-mono font-bold">- {currency} {discountAmount.toLocaleString()}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs pt-1 border-t border-border/80 font-bold">
              <span className="text-foreground">Net Payable Amount:</span>
              <span className="font-mono text-primary text-sm">
                {currency} {netAmount.toLocaleString()}
              </span>
            </div>

            <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                Current Expiry:
              </span>
              <span className="font-mono text-foreground font-medium">
                {activeSub.expiry_date
                  ? new Date(activeSub.expiry_date).toLocaleDateString([], {
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
              Receipt / Transaction Remarks (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Counter deposit, festive campaign promotion"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all shadow-md shadow-primary/20 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Recharge ({currency} {netAmount.toLocaleString()})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
