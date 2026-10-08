'use client';

import React from 'react';
import {
  Wallet,
  DollarSign,
  ShieldAlert,
  Percent,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  ArrowRight,
  Sparkles,
  Lock,
} from 'lucide-react';
import type { ResellerItem, ResellerTopupTarget } from '@/types/api';

interface ResellerTopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  reseller: ResellerTopupTarget | ResellerItem;
  currentUser?: any;
  onSuccess: () => void;
}

export function ResellerTopupModal({
  isOpen,
  onClose,
  reseller,
  currentUser,
  onSuccess,
}: ResellerTopupModalProps) {
  const [topupType, setTopupType] = React.useState<'CASH' | 'CREDIT'>('CASH');
  const [amountStr, setAmountStr] = React.useState('');
  const [commissionPercent, setCommissionPercent] = React.useState<number>(
    reseller.commission_percent ?? 50.0
  );
  const [allowCreditOverride, setAllowCreditOverride] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState('Cash');
  const [reference, setReference] = React.useState('');
  const [remarks, setRemarks] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Can user edit commission percentage?
  const canEditCommission = React.useMemo(() => {
    if (!currentUser) return true;
    if (['super_admin', 'admin', 'organization_admin'].includes(currentUser.role)) return true;
    const perms = currentUser.permissions || [];
    return perms.includes('*') || perms.includes('pricing.commission') || perms.includes('pricing.edit');
  }, [currentUser]);

  // Can user override credit limit?
  const canOverrideCredit = React.useMemo(() => {
    if (!currentUser) return true;
    if (['super_admin', 'admin', 'organization_admin'].includes(currentUser.role)) return true;
    const perms = currentUser.permissions || [];
    return perms.includes('*') || perms.includes('reseller.credit.override');
  }, [currentUser]);

  // Reset values when opened or reseller changes
  React.useEffect(() => {
    if (isOpen) {
      setAmountStr('');
      setCommissionPercent(reseller.commission_percent ?? 50.0);
      setPaymentMethod('Cash');
      setReference('');
      setRemarks('');
      setError(null);
      setAllowCreditOverride(false);
    }
  }, [isOpen, reseller]);

  const amount = parseFloat(amountStr) || 0;
  const commRate = (commissionPercent || 0) / 100;

  // Mathematical formula:
  // Wallet Value = Amount / (1 - Commission %)
  // Commission Value = Wallet Value - Amount
  const { walletValue, commissionValue } = React.useMemo(() => {
    if (amount <= 0 || commRate < 0 || commRate >= 1) {
      return { walletValue: 0, commissionValue: 0 };
    }
    if (commRate === 0) {
      return { walletValue: amount, commissionValue: 0 };
    }
    const val = Math.round((amount / (1 - commRate)) * 100) / 100;
    const comm = Math.round((val - amount) * 100) / 100;
    return { walletValue: val, commissionValue: comm };
  }, [amount, commRate]);

  // Credit calculation
  const creditLimit = reseller.credit_limit ?? 50000;
  const creditUsed = reseller.used_credit ?? reseller.credit_used ?? 0;
  const currentCreditRemaining = Math.max(0, creditLimit - creditUsed);
  const creditRemainingAfter = currentCreditRemaining - (topupType === 'CREDIT' ? amount : 0);
  const isCreditExceeded = topupType === 'CREDIT' && amount > currentCreditRemaining;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      setError('Please enter a valid payment amount greater than zero.');
      return;
    }
    if (commissionPercent < 0 || commissionPercent >= 100) {
      setError('Commission percentage must be between 0% and 99.99%.');
      return;
    }
    if (topupType === 'CREDIT' && isCreditExceeded && !allowCreditOverride) {
      setError(
        `Top-up exceeds approved credit limit. Remaining capacity: Rs. ${currentCreditRemaining.toFixed(2)}. Authorize override or reduce amount.`
      );
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Unique idempotency key to prevent double submissions
      const idempotencyKey = `topup-${reseller.id}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

      const res = await fetch(`/api/resellers/${reseller.id}/topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: topupType,
          amount,
          commission_percent: commissionPercent,
          payment_method: topupType === 'CASH' ? paymentMethod : 'Credit Facility',
          reference: reference.trim() || undefined,
          remarks: remarks.trim() || undefined,
          idempotency_key: idempotencyKey,
          allow_credit_override: allowCreditOverride,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || json.message || 'Top-up failed');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during top-up');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-5 border-b border-border bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                + Add Balance / Top-Up
                <span className="text-[11px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full">
                  {reseller.code}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Prepaid commission wallet top-up for {reseller.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Top-up Type Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Top-Up Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setTopupType('CASH');
                  setPaymentMethod('Cash');
                }}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                  topupType === 'CASH'
                    ? 'bg-purple-600/15 border-purple-500 text-purple-400 shadow-sm'
                    : 'bg-card border-border text-muted-foreground hover:border-border/80 hover:bg-muted/30'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                <span>CASH PAYMENT</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTopupType('CREDIT');
                  setPaymentMethod('Credit Facility');
                }}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                  topupType === 'CREDIT'
                    ? 'bg-amber-600/15 border-amber-500 text-amber-400 shadow-sm'
                    : 'bg-card border-border text-muted-foreground hover:border-border/80 hover:bg-muted/30'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                <span>CREDIT FACILITY</span>
              </button>
            </div>
          </div>

          {/* Credit Account Context Banner */}
          {topupType === 'CREDIT' && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
              <div className="flex justify-between items-center text-amber-400 font-semibold">
                <span>Credit Capacity Status</span>
                <span>
                  Rs. {currentCreditRemaining.toLocaleString()} Available
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Credit Limit: Rs. {creditLimit.toLocaleString()}</span>
                <span>Credit Used: Rs. {creditUsed.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* 2. Amount and Commission Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                {topupType === 'CASH' ? 'Cash Payment Amount (Rs.)' : 'Credit Top-Up Amount (Rs.)'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-semibold">
                  Rs.
                </span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  placeholder="e.g. 10000"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-muted/40 border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground flex items-center gap-1">
                  Commission %
                  {!canEditCommission && <Lock className="w-3 h-3 text-muted-foreground" />}
                </label>
                {!canEditCommission && (
                  <span className="text-[10px] text-muted-foreground">Pre-configured</span>
                )}
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="99.99"
                  step="0.01"
                  disabled={!canEditCommission}
                  value={commissionPercent}
                  onChange={(e) => setCommissionPercent(parseFloat(e.target.value) || 0)}
                  className="w-full pl-3 pr-8 py-2 bg-muted/40 border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-75 disabled:cursor-not-allowed"
                />
                <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-semibold">
                  %
                </span>
              </div>
            </div>
          </div>

          {/* 3. Live Mathematical Calculation Breakdown */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-purple-500/10 border border-purple-500/20 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Prepaid Calculation Preview
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-[11px] text-muted-foreground block">Commission Granted</span>
                <span className="text-sm font-bold text-emerald-400">
                  + Rs. {commissionValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Customer Selling Value</span>
                <span className="text-base font-extrabold text-foreground">
                  Rs. {walletValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {topupType === 'CREDIT' && (
              <div className="pt-2 border-t border-purple-500/10 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Credit Remaining After Top-Up:</span>
                <span className={`font-bold ${creditRemainingAfter < 0 ? 'text-red-400' : 'text-foreground'}`}>
                  Rs. {creditRemainingAfter.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          {/* Credit Limit Override Checkbox */}
          {topupType === 'CREDIT' && isCreditExceeded && canOverrideCredit && (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-start gap-2.5">
              <input
                type="checkbox"
                id="creditOverride"
                checked={allowCreditOverride}
                onChange={(e) => setAllowCreditOverride(e.target.checked)}
                className="mt-0.5 rounded border-amber-500 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="creditOverride" className="text-xs text-amber-300 font-medium cursor-pointer">
                Authorize Credit Override: Approve credit top-up beyond standard limit of Rs. {creditLimit.toLocaleString()}.
              </label>
            </div>
          )}

          {/* 4. Payment Method & Reference (for Cash) */}
          {topupType === 'CASH' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="QR">QR Code Payment</option>
                  <option value="Online Payment">Online Payment</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Payment Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Bank Ref # / Voucher ID"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          )}

          {/* Remarks */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Remarks / Reason</label>
            <input
              type="text"
              placeholder={topupType === 'CASH' ? 'Optional payment notes' : 'Required reason for credit top-up'}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-border">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || amount <= 0 || (topupType === 'CREDIT' && isCreditExceeded && !allowCreditOverride)}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 transition-all shadow-md shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm {topupType === 'CASH' ? 'Cash Top-Up' : 'Credit Top-Up'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
