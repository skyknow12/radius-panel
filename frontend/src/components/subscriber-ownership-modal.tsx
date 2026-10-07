'use client';

import React from 'react';
import { X, Building2, Store, ShieldAlert, ArrowRight, History, Check, AlertCircle } from 'lucide-react';
import type { BranchItem, ResellerItem, OwnershipHistoryItem } from '@/types/api';

interface SubscriberOwnershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriberId: number;
  username: string;
  currentOwnershipType: string;
  currentBranchId?: number | null;
  currentResellerId?: number | null;
  currentBranchName?: string | null;
  currentResellerName?: string | null;
  onSuccess: () => void;
}

export function SubscriberOwnershipModal({
  isOpen,
  onClose,
  subscriberId,
  username,
  currentOwnershipType,
  currentBranchId,
  currentResellerId,
  currentBranchName,
  currentResellerName,
  onSuccess,
}: SubscriberOwnershipModalProps) {
  const [ownershipType, setOwnershipType] = React.useState<'head_office' | 'branch' | 'reseller'>(
    (currentOwnershipType as any) || 'head_office'
  );
  const [branches, setBranches] = React.useState<BranchItem[]>([]);
  const [resellers, setResellers] = React.useState<ResellerItem[]>([]);
  const [selectedBranchId, setSelectedBranchId] = React.useState<number | ''>(currentBranchId || '');
  const [selectedResellerId, setSelectedResellerId] = React.useState<number | ''>(currentResellerId || '');
  const [reason, setReason] = React.useState('');
  const [history, setHistory] = React.useState<OwnershipHistoryItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setOwnershipType((currentOwnershipType as any) || 'head_office');
      setSelectedBranchId(currentBranchId || '');
      setSelectedResellerId(currentResellerId || '');
      setReason('');
      setError(null);
      fetchDependencies();
    }
  }, [isOpen, subscriberId]);

  const fetchDependencies = async () => {
    try {
      setLoading(true);
      const [brRes, resRes, histRes] = await Promise.all([
        fetch('/api/branches'),
        fetch('/api/resellers'),
        fetch(`/api/subscribers/${subscriberId}/ownership-history`),
      ]);

      if (brRes.ok) {
        const json = await brRes.json();
        setBranches(json.data || []);
      }
      if (resRes.ok) {
        const json = await resRes.json();
        setResellers(json.data || []);
      }
      if (histRes.ok) {
        const json = await histRes.json();
        setHistory(json.data || []);
      }
    } catch {
      setError('Failed to load branches and resellers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a mandatory transfer reason for audit logging.');
      return;
    }

    if (ownershipType === 'branch' && !selectedBranchId) {
      setError('Please select a target branch.');
      return;
    }

    if (ownershipType === 'reseller' && !selectedResellerId) {
      setError('Please select a target reseller.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const res = await fetch(`/api/subscribers/${subscriberId}/transfer-ownership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownership_type: ownershipType,
          branch_id: ownershipType === 'branch' ? Number(selectedBranchId) : null,
          reseller_id: ownershipType === 'reseller' ? Number(selectedResellerId) : null,
          reason: reason.trim(),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to update subscriber ownership');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Subscriber Ownership & Transfer</h2>
              <p className="text-xs text-muted-foreground font-mono">
                Subscriber: <span className="text-primary font-bold">{username}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Current Ownership Snapshot */}
          <div className="p-4 rounded-xl border border-border bg-card/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block mb-0.5">
                Current Authoritative Owner
              </span>
              <div className="text-sm font-bold text-foreground capitalize flex items-center gap-2">
                {currentOwnershipType === 'head_office' ? (
                  <span className="text-primary flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" /> Head Office (Direct ISP)
                  </span>
                ) : currentOwnershipType === 'branch' ? (
                  <span className="text-blue-400 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4" /> Branch: {currentBranchName || `ID ${currentBranchId}`}
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1.5">
                    <Store className="w-4 h-4" /> Reseller: {currentResellerName || `ID ${currentResellerId}`}
                  </span>
                )}
              </div>
            </div>
            <div className="text-xs px-2.5 py-1 rounded-md bg-muted text-muted-foreground font-semibold">
              Authoritative
            </div>
          </div>

          {/* Transfer Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-2">
                Select New Ownership Channel
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setOwnershipType('head_office')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    ownershipType === 'head_office'
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                      : 'border-border hover:bg-muted text-muted-foreground'
                  }`}
                >
                  <div className="text-xs flex items-center justify-between">
                    <span>Head Office</span>
                    {ownershipType === 'head_office' && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <div className="text-[10px] font-normal text-muted-foreground mt-1">Direct ISP customer</div>
                </button>

                <button
                  type="button"
                  onClick={() => setOwnershipType('branch')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    ownershipType === 'branch'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400 font-bold shadow-sm'
                      : 'border-border hover:bg-muted text-muted-foreground'
                  }`}
                >
                  <div className="text-xs flex items-center justify-between">
                    <span>Branch</span>
                    {ownershipType === 'branch' && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <div className="text-[10px] font-normal text-muted-foreground mt-1">Regional Branch office</div>
                </button>

                <button
                  type="button"
                  onClick={() => setOwnershipType('reseller')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    ownershipType === 'reseller'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-400 font-bold shadow-sm'
                      : 'border-border hover:bg-muted text-muted-foreground'
                  }`}
                >
                  <div className="text-xs flex items-center justify-between">
                    <span>Reseller</span>
                    {ownershipType === 'reseller' && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <div className="text-[10px] font-normal text-muted-foreground mt-1">Wholesale Reseller</div>
                </button>
              </div>
            </div>

            {/* Branch Selector */}
            {ownershipType === 'branch' && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                  Select Target Branch *
                </label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value ? Number(e.target.value) : '')}
                  required
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- Choose Branch --</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code}) - {b.manager_name || 'No Manager'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Reseller Selector */}
            {ownershipType === 'reseller' && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                  Select Target Reseller *
                </label>
                <select
                  value={selectedResellerId}
                  onChange={(e) => setSelectedResellerId(e.target.value ? Number(e.target.value) : '')}
                  required
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- Choose Reseller --</option>
                  {resellers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code}) - {r.contact_person || 'N/A'} [{r.commission_model.toUpperCase()}]
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                Audit Reason for Transfer *
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                rows={2}
                placeholder="e.g. Customer migrated area to Pokhara Ward 6 / reassigned to regional wholesale partner ABC Net"
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-md shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
              >
                {saving ? 'Recording Transfer...' : 'Confirm Ownership Transfer'}
              </button>
            </div>
          </form>

          {/* Audit History Timeline */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Ownership Change History
              </h3>
            </div>

            {loading ? (
              <div className="text-xs text-muted-foreground animate-pulse">Loading history...</div>
            ) : history.length === 0 ? (
              <div className="text-xs text-muted-foreground italic py-2 bg-muted/20 rounded-lg text-center">
                No previous transfers recorded. Original ownership retained.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                {history.map((h) => (
                  <div key={h.id} className="p-3 rounded-xl border border-border/70 bg-card text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <span className="capitalize text-muted-foreground">
                          {h.previous_ownership_type}: {h.previous_branch_name || h.previous_reseller_name || 'Head Office'}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-primary" />
                        <span className="capitalize text-primary font-bold">
                          {h.new_ownership_type}: {h.new_branch_name || h.new_reseller_name || 'Head Office'}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(h.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    {h.reason && (
                      <p className="text-[11px] text-muted-foreground italic">"{h.reason}"</p>
                    )}
                    <div className="text-[10px] text-muted-foreground">
                      Changed by: <span className="font-medium text-foreground">{h.changed_by}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
