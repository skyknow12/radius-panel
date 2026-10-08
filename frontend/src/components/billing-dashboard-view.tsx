'use client';

import React from 'react';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Users,
  Clock,
  AlertTriangle,
  RotateCcw,
  PlusCircle,
  FileText,
  Calendar,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import type { BillingDashboardMetrics, BillingTransactionItem } from '@/types/api';
import { TransactionDetailsModal } from './transaction-details-modal';
import { ReceiptModal } from './receipt-modal';

interface BillingDashboardViewProps {
  onNavigate: (tab: string, filter?: string) => void;
  onViewSubscriber?: (username: string) => void;
  onOpenRechargeModal?: () => void;
}

export function BillingDashboardView({
  onNavigate,
  onViewSubscriber,
  onOpenRechargeModal,
}: BillingDashboardViewProps) {
  const [data, setData] = React.useState<BillingDashboardMetrics | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  // Selected transaction for details modal
  const [selectedTxId, setSelectedTxId] = React.useState<string | null>(null);
  const [receiptTx, setReceiptTx] = React.useState<BillingTransactionItem | null>(null);

  const fetchMetrics = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/billing/dashboard');
      if (!res.ok) throw new Error('Failed to load billing metrics');
      const json = await res.json();
      setData(json.data);
    } catch (err: any) {
      setError(err.message || 'Error loading billing dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            Core Billing & Financial Dashboard
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time subscriber recharges, ledger revenue calculations, and lifecycle renewals.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {onOpenRechargeModal && (
            <button
              onClick={onOpenRechargeModal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold transition-all shadow-md shadow-primary/20"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Recharge</span>
            </button>
          )}

          <button
            onClick={() => onNavigate('billing_transactions')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors"
          >
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span>All Transactions</span>
          </button>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && !data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 animate-pulse">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-card border border-border" />
          ))}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {data && (
        <>
          {/* Revenue Ledger Formula Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-card via-card/90 to-primary/5 border border-border shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider block">
                  Accounting Ledger Formula
                </span>
                <h3 className="text-sm font-bold text-foreground mt-0.5">
                  Net Revenue = Gross Revenue − Discounts − Refunds
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-muted/40 border border-border">
                  <span className="text-[10px] text-muted-foreground block font-sans">Gross</span>
                  <span className="font-bold text-foreground">
                    Rs. {Number(data.grossRevenue).toLocaleString()}
                  </span>
                </div>
                <span className="text-muted-foreground font-sans font-bold">−</span>
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                  <span className="text-[10px] block font-sans">Discounts</span>
                  <span className="font-bold">
                    Rs. {Number(data.totalDiscounts).toLocaleString()}
                  </span>
                </div>
                <span className="text-muted-foreground font-sans font-bold">−</span>
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                  <span className="text-[10px] block font-sans">Refunds</span>
                  <span className="font-bold">
                    Rs. {Number(data.totalRefunds).toLocaleString()}
                  </span>
                </div>
                <span className="text-muted-foreground font-sans font-bold">=</span>
                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/30 text-primary">
                  <span className="text-[10px] block font-sans font-semibold">Net Total Revenue</span>
                  <span className="font-bold text-base">
                    Rs. {Number(data.netRevenue).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 10 Clickable Primary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Card 1: Today's Revenue */}
            <div
              onClick={() => onNavigate('billing_transactions')}
              className="p-4 rounded-2xl bg-card border border-border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Today&apos;s Revenue</span>
                <DollarSign className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="font-mono text-xl font-bold text-foreground mt-2">
                Rs. {Number(data.todayRevenue).toLocaleString()}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 group-hover:text-primary transition-colors">
                View transactions <ArrowRight className="w-3 h-3" />
              </span>
            </div>

            {/* Card 2: This Month's Revenue */}
            <div
              onClick={() => onNavigate('billing_reports')}
              className="p-4 rounded-2xl bg-card border border-border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Monthly Revenue</span>
                <TrendingUp className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="font-mono text-xl font-bold text-foreground mt-2">
                Rs. {Number(data.monthRevenue).toLocaleString()}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 group-hover:text-primary transition-colors">
                View monthly report <ArrowRight className="w-3 h-3" />
              </span>
            </div>

            {/* Card 3: Today's Recharges */}
            <div
              onClick={() => onNavigate('billing_transactions')}
              className="p-4 rounded-2xl bg-card border border-border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Today Recharges</span>
                <CheckCircle2 className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="font-mono text-xl font-bold text-foreground mt-2">
                {data.todayRechargesCount}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 group-hover:text-primary transition-colors">
                Processed today <ArrowRight className="w-3 h-3" />
              </span>
            </div>

            {/* Card 4: Monthly Recharges */}
            <div
              onClick={() => onNavigate('billing_transactions')}
              className="p-4 rounded-2xl bg-card border border-border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Month Recharges</span>
                <Calendar className="w-4 h-4 text-purple-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="font-mono text-xl font-bold text-foreground mt-2">
                {data.monthRechargesCount}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 group-hover:text-primary transition-colors">
                Monthly volume <ArrowRight className="w-3 h-3" />
              </span>
            </div>

            {/* Card 5: Active Subscribers */}
            <div
              onClick={() => onNavigate('subscribers')}
              className="p-4 rounded-2xl bg-card border border-border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Active Subs</span>
                <Users className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="font-mono text-xl font-bold text-foreground mt-2">
                {data.activeSubscribers}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 group-hover:text-primary transition-colors">
                Active & online <ArrowRight className="w-3 h-3" />
              </span>
            </div>

            {/* Card 6: Expiring Today */}
            <div
              onClick={() => onNavigate('billing_expiry', 'today')}
              className="p-4 rounded-2xl bg-card border border-border hover:border-rose-500/50 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-500">Expiring Today</span>
                <Clock className="w-4 h-4 text-rose-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="font-mono text-xl font-bold text-rose-500 mt-2">
                {data.expiringTodayCount}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 group-hover:text-rose-500 transition-colors">
                Immediate renewal <ArrowRight className="w-3 h-3" />
              </span>
            </div>

            {/* Card 7: Expiring Soon (7 Days) */}
            <div
              onClick={() => onNavigate('billing_expiry', '7days')}
              className="p-4 rounded-2xl bg-card border border-border hover:border-amber-500/50 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-500">Expiring in 7 Days</span>
                <AlertTriangle className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="font-mono text-xl font-bold text-amber-500 mt-2">
                {data.expiringSoonCount}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 group-hover:text-amber-500 transition-colors">
                Upcoming expiry <ArrowRight className="w-3 h-3" />
              </span>
            </div>

            {/* Card 8: Expired Subscribers */}
            <div
              onClick={() => onNavigate('billing_expiry', 'expired')}
              className="p-4 rounded-2xl bg-card border border-border hover:border-rose-500/50 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-400">Expired Subs</span>
                <Clock className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="font-mono text-xl font-bold text-foreground mt-2">
                {data.expiredSubscribersCount}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 group-hover:text-primary transition-colors">
                Suspended list <ArrowRight className="w-3 h-3" />
              </span>
            </div>

            {/* Card 9: Pending Transactions */}
            <div
              onClick={() => onNavigate('billing_transactions')}
              className="p-4 rounded-2xl bg-card border border-border hover:border-blue-500/50 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">Pending Txns</span>
                <Clock className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="font-mono text-xl font-bold text-foreground mt-2">
                {data.pendingTransactionsCount}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 group-hover:text-blue-400 transition-colors">
                Pending capture <ArrowRight className="w-3 h-3" />
              </span>
            </div>

            {/* Card 10: Refunds */}
            <div
              onClick={() => onNavigate('billing_reports')}
              className="p-4 rounded-2xl bg-card border border-border hover:border-amber-500/50 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-500">Refunds Issued</span>
                <RotateCcw className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="font-mono text-xl font-bold text-foreground mt-2">
                Rs. {Number(data.refundsAmount).toLocaleString()}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 group-hover:text-amber-500 transition-colors">
                Audit ledger <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Wallets, Credit Lines, and Commissions Quick Navigation */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div
              onClick={() => onNavigate('wallets')}
              className="p-4 rounded-2xl bg-card border border-border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-foreground block group-hover:text-primary transition-colors">Channel Wallets</span>
                  <span className="text-[11px] text-muted-foreground">Prepaid balances & top-ups</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>

            <div
              onClick={() => onNavigate('wallets')}
              className="p-4 rounded-2xl bg-card border border-border hover:border-indigo-500/50 hover:shadow-md transition-all cursor-pointer group flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-foreground block group-hover:text-indigo-400 transition-colors">Outstanding Credit Lines</span>
                  <span className="text-[11px] text-muted-foreground">Postpaid limits & exposure</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
            </div>

            <div
              onClick={() => onNavigate('commission_report')}
              className="p-4 rounded-2xl bg-card border border-border hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer group flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-foreground block group-hover:text-emerald-400 transition-colors">Reseller Commissions</span>
                  <span className="text-[11px] text-muted-foreground">Channel payouts & settlements</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>

          {/* Recent 10 Transactions Table */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Recent Recharge & Billing Transactions
                </h3>
                <p className="text-xs text-muted-foreground">
                  Click any transaction ID or subscriber username for full financial records and receipts.
                </p>
              </div>
              <button
                onClick={() => onNavigate('billing_transactions')}
                className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
              >
                <span>View all records</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground font-semibold">
                    <th className="py-2.5 px-3">Transaction ID</th>
                    <th className="py-2.5 px-3">Date / Time</th>
                    <th className="py-2.5 px-3">Subscriber</th>
                    <th className="py-2.5 px-3">Package</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3 text-right">Net Amount</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {data.recentTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-muted-foreground">
                        No transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    data.recentTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold">
                          <button
                            onClick={() => setSelectedTxId(tx.transaction_id)}
                            className="text-primary hover:underline"
                          >
                            {tx.transaction_id}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground font-mono">
                          {new Date(tx.recharge_date).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2.5 px-3">
                          <button
                            onClick={() => onViewSubscriber?.(tx.username)}
                            className="font-bold text-foreground hover:text-primary transition-colors"
                          >
                            {tx.username}
                          </button>
                          <span className="block text-[10px] text-muted-foreground font-mono">
                            CID: {tx.customer_id}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-foreground">
                          {tx.package_name}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {tx.duration} mo
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-500">
                          {tx.currency} {Number(tx.final_amount).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          <span className="font-medium text-foreground">{tx.payment_method}</span>
                          {tx.payment_reference && (
                            <span className="block text-[10px] font-mono text-muted-foreground truncate max-w-[120px]">
                              {tx.payment_reference}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              tx.status === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                : tx.status === 'REFUNDED'
                                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                : tx.status === 'PENDING'
                                ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => setReceiptTx(tx)}
                            className="px-2.5 py-1 rounded-lg border border-border hover:bg-muted font-medium text-[11px] transition-colors"
                          >
                            Receipt
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Transaction Details Modal */}
      <TransactionDetailsModal
        isOpen={selectedTxId !== null}
        onClose={() => setSelectedTxId(null)}
        transactionId={selectedTxId}
        onUpdate={fetchMetrics}
        onViewSubscriber={onViewSubscriber}
      />

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={receiptTx !== null}
        onClose={() => setReceiptTx(null)}
        transaction={receiptTx}
      />
    </div>
  );
}
