'use client';

import React from 'react';
import {
  FileText,
  Clock,
  Printer,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  CreditCard,
  History,
} from 'lucide-react';
import type { BillingTransactionItem, RefundItem } from '@/types/api';
import { ReceiptModal } from './receipt-modal';

interface TransactionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: string | null;
  onUpdate?: () => void;
  onViewSubscriber?: (username: string) => void;
}

export function TransactionDetailsModal({
  isOpen,
  onClose,
  transactionId,
  onUpdate,
  onViewSubscriber,
}: TransactionDetailsModalProps) {
  const [loading, setLoading] = React.useState<boolean>(true);
  const [transaction, setTransaction] = React.useState<BillingTransactionItem | null>(null);
  const [refunds, setRefunds] = React.useState<RefundItem[]>([]);
  const [timeline, setTimeline] = React.useState<{ timestamp: string; action: string; actor: string; details: string }[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // Refund dialog state
  const [refundOpen, setRefundOpen] = React.useState<boolean>(false);
  const [refundAmount, setRefundAmount] = React.useState<string>('');
  const [refundReason, setRefundReason] = React.useState<string>('');
  const [refundSubmitting, setRefundSubmitting] = React.useState<boolean>(false);

  // Receipt modal state
  const [receiptOpen, setReceiptOpen] = React.useState<boolean>(false);

  const fetchDetails = React.useCallback(async () => {
    if (!transactionId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/billing/transactions/${encodeURIComponent(transactionId)}`);
      if (!res.ok) throw new Error('Failed to load transaction details');
      const json = await res.json();
      const data = json.data;
      setTransaction(data.transaction);
      setRefunds(data.refunds || []);
      setTimeline(data.timeline || []);
      if (data.transaction) {
        setRefundAmount(data.transaction.final_amount);
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching transaction');
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  React.useEffect(() => {
    if (isOpen && transactionId) {
      fetchDetails();
    } else {
      setTransaction(null);
      setRefunds([]);
      setTimeline([]);
    }
  }, [isOpen, transactionId, fetchDetails]);

  if (!isOpen || !transactionId) return null;

  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction) return;
    try {
      setRefundSubmitting(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('radius_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/billing/transactions/${encodeURIComponent(transaction.transaction_id)}/refund`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amount: refundAmount ? Number(refundAmount) : undefined,
          reason: refundReason.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || json.message || 'Refund failed');

      setRefundOpen(false);
      setRefundReason('');
      fetchDetails();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      alert(`Refund Error: ${err.message}`);
    } finally {
      setRefundSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> COMPLETED
          </span>
        );
      case 'PARTIALLY_REFUNDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <RotateCcw className="w-3.5 h-3.5" /> PARTIALLY REFUNDED
          </span>
        );
      case 'REFUNDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <RotateCcw className="w-3.5 h-3.5" /> REFUNDED
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <Clock className="w-3.5 h-3.5" /> PENDING
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" /> CANCELLED
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-muted text-muted-foreground">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">
                  Transaction: {transaction?.transaction_id || transactionId}
                </h3>
                {transaction && getStatusBadge(transaction.status)}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Financial Transaction Ledger & Audit Trail
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5 text-xs">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading transaction details...
            </div>
          ) : error || !transaction ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error || 'Transaction not found'}</span>
            </div>
          ) : (
            <>
              {/* Primary Info Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-muted/40 border border-border">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Subscriber</span>
                  <button
                    onClick={() => {
                      if (onViewSubscriber) {
                        onClose();
                        onViewSubscriber(transaction.username);
                      }
                    }}
                    className="font-bold text-primary hover:underline text-xs mt-1 block truncate text-left"
                  >
                    {transaction.username}
                  </button>
                  <span className="text-[10px] text-muted-foreground font-mono">CID: {transaction.customer_id}</span>
                </div>

                <div className="p-3 rounded-xl bg-muted/40 border border-border">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Package</span>
                  <span className="font-bold text-foreground text-xs mt-1 block truncate">
                    {transaction.package_name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{transaction.duration} Month(s)</span>
                </div>

                <div className="p-3 rounded-xl bg-muted/40 border border-border">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Net Amount</span>
                  <span className="font-mono font-bold text-emerald-500 text-sm mt-0.5 block">
                    {transaction.currency} {Number(transaction.final_amount).toLocaleString()}
                  </span>
                  {Number(transaction.discount_amount) > 0 && (
                    <span className="text-[10px] text-muted-foreground font-mono line-through">
                      {transaction.currency} {Number(transaction.original_price).toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-muted/40 border border-border">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Payment Method</span>
                  <span className="font-bold text-foreground text-xs mt-1 block">
                    {transaction.payment_method}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono truncate block">
                    {transaction.payment_reference || 'No reference'}
                  </span>
                </div>
              </div>

              {/* Service Extension Timeline Info */}
              <div className="p-4 rounded-xl bg-card border border-border space-y-2">
                <h4 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" /> Service Extension Window
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Previous Valid Expiry:</span>
                    <span className="font-mono text-foreground font-medium">
                      {transaction.previous_expiry ? new Date(transaction.previous_expiry).toLocaleDateString() : 'None / Expired'}
                    </span>
                  </div>
                  <div>
                    <span className="text-emerald-500 font-semibold block text-[11px]">New Extended Expiry:</span>
                    <span className="font-mono font-bold text-emerald-500">
                      {new Date(transaction.new_expiry).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Audit Timeline */}
              <div className="space-y-3">
                <h4 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-indigo-400" /> Audit Timeline
                </h4>
                <div className="space-y-2 border-l-2 border-border ml-2 pl-3">
                  {timeline.map((entry, idx) => (
                    <div key={idx} className="relative pb-2">
                      <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-primary" />
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-foreground">{entry.action}</span>
                        <span className="text-muted-foreground font-mono">
                          {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{entry.details}</p>
                      <span className="text-[10px] text-muted-foreground/80 font-mono">By: {entry.actor}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Refund Form (Conditional) */}
              {refundOpen && (
                <form onSubmit={handleProcessRefund} className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                  <h4 className="font-bold text-amber-500 flex items-center gap-1.5">
                    <RotateCcw className="w-4 h-4" /> Issue Transaction Refund
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-foreground mb-1">
                        Refund Amount ({transaction.currency}) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        max={transaction.final_amount}
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                        className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-foreground mb-1">
                        Reason for Refund *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Plan downgraded, customer dispute"
                        value={refundReason}
                        onChange={(e) => setRefundReason(e.target.value)}
                        className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setRefundOpen(false)}
                      className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={refundSubmitting}
                      className="px-4 py-1.5 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600 text-xs shadow-sm"
                    >
                      {refundSubmitting ? 'Processing...' : 'Confirm Refund'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>

        {/* Modal Footer Controls */}
        {transaction && (
          <div className="pt-4 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReceiptOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 text-xs font-semibold transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>View / Print Receipt</span>
              </button>

              {transaction.status === 'COMPLETED' && !refundOpen && (
                <button
                  type="button"
                  onClick={() => setRefundOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500/20 text-xs font-semibold transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Issue Refund</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted font-medium text-xs transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>

      {/* Embedded Receipt Modal */}
      {transaction && (
        <ReceiptModal
          isOpen={receiptOpen}
          onClose={() => setReceiptOpen(false)}
          transaction={transaction}
        />
      )}
    </div>
  );
}
