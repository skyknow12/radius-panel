'use client';

import React from 'react';
import {
  FileText,
  Search,
  Filter,
  Download,
  RotateCcw,
  CheckCircle2,
  Clock,
  XCircle,
  Calendar,
  Printer,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { BillingTransactionItem } from '@/types/api';
import { TransactionDetailsModal } from './transaction-details-modal';
import { ReceiptModal } from './receipt-modal';

interface BillingTransactionsViewProps {
  onViewSubscriber?: (username: string) => void;
  initialStatusFilter?: string;
}

export function BillingTransactionsView({
  onViewSubscriber,
  initialStatusFilter,
}: BillingTransactionsViewProps) {
  const [transactions, setTransactions] = React.useState<BillingTransactionItem[]>([]);
  const [total, setTotal] = React.useState<number>(0);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [statusFilter, setStatusFilter] = React.useState<string>(initialStatusFilter || '');
  const [methodFilter, setMethodFilter] = React.useState<string>('');
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [page, setPage] = React.useState<number>(1);
  const limit = 20;

  // Selected modals
  const [selectedTxId, setSelectedTxId] = React.useState<string | null>(null);
  const [receiptTx, setReceiptTx] = React.useState<BillingTransactionItem | null>(null);

  const fetchTransactions = React.useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (methodFilter) params.set('payment_method', methodFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      params.set('limit', String(limit));
      params.set('offset', String((page - 1) * limit));

      const res = await fetch(`/api/billing/transactions?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setTransactions(json.data.items || []);
        setTotal(json.data.total || 0);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [statusFilter, methodFilter, searchQuery, page]);

  React.useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleExportCsv = () => {
    window.open('/api/billing/reports/export?type=daily', '_blank');
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Billing Transactions & Ledger Records
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Full audit log of subscriber recharges, payment references, receipts, and refund statuses.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card border border-border hover:bg-muted text-xs font-semibold text-foreground transition-colors shadow-sm"
        >
          <Download className="w-4 h-4 text-emerald-500" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-3.5 rounded-2xl bg-card border border-border flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Txn ID, username, CID, reference..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full bg-muted/50 border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-muted/50 border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none font-medium"
          >
            <option value="">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING">Pending</option>
            <option value="REFUNDED">Refunded</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Payment Method Filter */}
          <select
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value);
              setPage(1);
            }}
            className="bg-muted/50 border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none font-medium"
          >
            <option value="">All Payment Methods</option>
            <option value="Cash">Cash</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Fonepay / QR Payment">QR / Fonepay</option>
            <option value="Digital Wallet">Digital Wallet (eSewa/Khalti)</option>
            <option value="Staff / Complimentary">Complimentary</option>
          </select>
        </div>

        <div className="text-xs text-muted-foreground font-mono">
          Showing {transactions.length} of {total} records
        </div>
      </div>

      {/* Transactions Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
                <th className="py-3 px-3.5">Transaction ID</th>
                <th className="py-3 px-3.5">Date / Time</th>
                <th className="py-3 px-3.5">Subscriber</th>
                <th className="py-3 px-3.5">Package</th>
                <th className="py-3 px-3.5">Duration</th>
                <th className="py-3 px-3.5 text-right">Original</th>
                <th className="py-3 px-3.5 text-right">Discount</th>
                <th className="py-3 px-3.5 text-right">Net Final</th>
                <th className="py-3 px-3.5">Method & Ref</th>
                <th className="py-3 px-3.5 text-center">Status</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-muted-foreground">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading financial transactions...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-muted-foreground">
                    No transactions match your filter criteria.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-3.5 font-mono font-bold">
                      <button
                        onClick={() => setSelectedTxId(tx.transaction_id)}
                        className="text-primary hover:underline"
                      >
                        {tx.transaction_id}
                      </button>
                    </td>
                    <td className="py-3 px-3.5 text-muted-foreground font-mono">
                      {new Date(tx.recharge_date).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-3.5">
                      <button
                        onClick={() => onViewSubscriber?.(tx.username)}
                        className="font-bold text-foreground hover:text-primary transition-colors text-left"
                      >
                        {tx.username}
                      </button>
                      <span className="block text-[10px] text-muted-foreground font-mono">
                        CID: {tx.customer_id}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 font-medium text-foreground">
                      {tx.package_name}
                    </td>
                    <td className="py-3 px-3.5 text-muted-foreground">
                      {tx.duration} mo
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono text-muted-foreground">
                      {tx.currency} {Number(tx.original_price).toLocaleString()}
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono text-emerald-500 font-medium">
                      {Number(tx.discount_amount) > 0 ? `- ${Number(tx.discount_amount).toLocaleString()}` : '—'}
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono font-bold text-foreground">
                      {tx.currency} {Number(tx.final_amount).toLocaleString()}
                    </td>
                    <td className="py-3 px-3.5 text-muted-foreground">
                      <span className="font-medium text-foreground">{tx.payment_method}</span>
                      {tx.payment_reference && (
                        <span className="block text-[10px] font-mono text-muted-foreground truncate max-w-[130px]" title={tx.payment_reference}>
                          Ref: {tx.payment_reference}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
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
                    <td className="py-3 px-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setReceiptTx(tx)}
                          className="px-2.5 py-1 rounded-lg border border-border hover:bg-muted font-medium text-[11px] text-foreground transition-colors flex items-center gap-1"
                          title="Print Receipt"
                        >
                          <Printer className="w-3 h-3 text-muted-foreground" />
                          <span>Receipt</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3.5 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Details Modal */}
      <TransactionDetailsModal
        isOpen={selectedTxId !== null}
        onClose={() => setSelectedTxId(null)}
        transactionId={selectedTxId}
        onUpdate={fetchTransactions}
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
