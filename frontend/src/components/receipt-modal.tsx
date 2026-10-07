'use client';

import React from 'react';
import { Printer, Download, CheckCircle, Zap } from 'lucide-react';
import type { BillingTransactionItem } from '@/types/api';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: BillingTransactionItem | null;
}

export function ReceiptModal({ isOpen, onClose, transaction }: ReceiptModalProps) {
  if (!isOpen || !transaction) return null;

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const formatShortDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-150 print:p-0 print:bg-white print:static">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-150 print:border-none print:shadow-none print:w-full print:max-w-none print:p-4 text-foreground">
        {/* Modal Controls - Hidden when printing */}
        <div className="flex items-center justify-between pb-4 border-b border-border mb-6 print:hidden">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Official Payment Receipt
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium transition-colors shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-sm p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div className="space-y-6 print:space-y-4">
          {/* Header Brand */}
          <div className="flex items-start justify-between border-b border-border/80 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 via-indigo-600 to-primary flex items-center justify-center text-white font-bold shadow-md print:bg-black print:text-white">
                <Zap className="w-5 h-5 fill-white/20 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-base font-bold tracking-tight text-foreground uppercase">
                  SKY RADIUS ISP
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  High-Speed Optical Broadband Network
                </p>
                <p className="text-[10px] text-muted-foreground/80 font-mono">
                  Support: +977-1-5970000 • support@skyradius.net
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-wider print:border-black print:text-black">
                {transaction.status}
              </span>
              <div className="font-mono text-xs font-bold text-foreground mt-1.5">
                {transaction.transaction_id}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {formatDate(transaction.recharge_date)}
              </div>
            </div>
          </div>

          {/* Customer & Subscription Snapshot */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/40 border border-border text-xs print:bg-transparent print:border print:p-2">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider block mb-1">
                Billed To
              </span>
              <div className="font-bold text-foreground text-sm">
                {transaction.full_name || transaction.username}
              </div>
              <div className="text-muted-foreground font-mono mt-0.5">
                Username: <span className="font-semibold text-foreground">{transaction.username}</span>
              </div>
              <div className="text-muted-foreground font-mono">
                Customer ID: <span className="font-semibold text-foreground">{transaction.customer_id}</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider block mb-1">
                Service Package
              </span>
              <div className="font-bold text-primary text-sm print:text-black">
                {transaction.package_name}
              </div>
              <div className="text-muted-foreground mt-0.5">
                Duration: <span className="font-semibold text-foreground">{transaction.duration} Month(s)</span>
              </div>
              <div className="text-muted-foreground font-mono">
                Method: <span className="font-semibold text-foreground">{transaction.payment_method}</span>
              </div>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="border border-border rounded-xl overflow-hidden text-xs">
            <div className="grid grid-cols-12 bg-muted/60 px-3 py-2 font-semibold text-muted-foreground border-b border-border">
              <div className="col-span-7">Description</div>
              <div className="col-span-2 text-center">Duration</div>
              <div className="col-span-3 text-right">Amount</div>
            </div>

            <div className="grid grid-cols-12 px-3 py-3 items-center border-b border-border/50">
              <div className="col-span-7 font-medium">
                {transaction.package_name} Broadband Internet Plan
              </div>
              <div className="col-span-2 text-center font-mono">
                {transaction.duration} mo
              </div>
              <div className="col-span-3 text-right font-mono font-medium">
                {transaction.currency} {Number(transaction.original_price).toLocaleString()}
              </div>
            </div>

            {Number(transaction.discount_amount) > 0 && (
              <div className="grid grid-cols-12 px-3 py-2 items-center border-b border-border/50 text-emerald-500">
                <div className="col-span-7 font-medium">
                  Promotional Discount ({transaction.discount_type === 'percentage' ? `${transaction.discount_value}%` : 'Special'})
                </div>
                <div className="col-span-2 text-center font-mono">-</div>
                <div className="col-span-3 text-right font-mono font-bold">
                  - {transaction.currency} {Number(transaction.discount_amount).toLocaleString()}
                </div>
              </div>
            )}

            {Number(transaction.tax_amount) > 0 && (
              <div className="grid grid-cols-12 px-3 py-2 items-center border-b border-border/50 text-muted-foreground">
                <div className="col-span-7">VAT / Tax ({transaction.tax_rate}%)</div>
                <div className="col-span-2 text-center font-mono">-</div>
                <div className="col-span-3 text-right font-mono">
                  + {transaction.currency} {Number(transaction.tax_amount).toLocaleString()}
                </div>
              </div>
            )}

            <div className="grid grid-cols-12 px-3 py-3 items-center bg-muted/30 font-bold text-sm">
              <div className="col-span-7 text-foreground">Total Paid Amount</div>
              <div className="col-span-5 text-right font-mono text-primary text-base print:text-black">
                {transaction.currency} {Number(transaction.final_amount).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Service Expiry Extension Details */}
          <div className="grid grid-cols-2 gap-3 text-xs p-3 rounded-xl bg-card border border-border">
            <div>
              <span className="text-[10px] text-muted-foreground block">Previous Valid Expiry</span>
              <span className="font-mono text-muted-foreground">
                {formatShortDate(transaction.previous_expiry)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-emerald-500 font-semibold block">Extended Service Expiry</span>
              <span className="font-mono font-bold text-emerald-500 text-sm">
                {formatShortDate(transaction.new_expiry)}
              </span>
            </div>
          </div>

          {/* Payment Reference & Remarks */}
          <div className="text-[11px] text-muted-foreground space-y-1">
            {transaction.payment_reference && (
              <div>
                <span className="font-semibold text-foreground">Transaction Reference:</span>{' '}
                <span className="font-mono">{transaction.payment_reference}</span>
              </div>
            )}
            {transaction.notes && (
              <div>
                <span className="font-semibold text-foreground">Operator Remarks:</span> {transaction.notes}
              </div>
            )}
            <div>
              <span className="font-semibold text-foreground">Cashier / Staff:</span> {transaction.created_by}
            </div>
          </div>

          {/* Footer Notice */}
          <div className="pt-4 border-t border-border/80 text-center text-[10px] text-muted-foreground">
            <p>Thank you for choosing SKY RADIUS. This is a computer-generated official receipt.</p>
            <p className="mt-0.5">Keep this receipt for warranty and service records.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
