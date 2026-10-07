'use client';

import React from 'react';
import {
  DollarSign,
  Plus,
  Trash2,
  Calculator,
  Percent,
  Building2,
  Store,
  Layers,
  ArrowRight,
  Check,
  AlertCircle,
  X,
  HelpCircle
} from 'lucide-react';
import type { ChannelPricingRuleItem, BranchItem, ResellerItem, PackageItem } from '@/types/api';

export function ChannelPricingView() {
  const [rules, setRules] = React.useState<ChannelPricingRuleItem[]>([]);
  const [branches, setBranches] = React.useState<BranchItem[]>([]);
  const [resellers, setResellers] = React.useState<ResellerItem[]>([]);
  const [packages, setPackages] = React.useState<PackageItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Create form state
  const [ruleName, setRuleName] = React.useState('');
  const [channelType, setChannelType] = React.useState<'branch' | 'reseller'>('reseller');
  const [targetEntityId, setTargetEntityId] = React.useState<number | ''>('');
  const [targetPackageId, setTargetPackageId] = React.useState<number | ''>('');
  const [targetDuration, setTargetDuration] = React.useState<number | ''>('');
  const [ruleType, setRuleType] = React.useState<
    'percentage_discount' | 'percentage_commission' | 'fixed_discount' | 'fixed_override'
  >('percentage_discount');
  const [ruleValue, setRuleValue] = React.useState('');
  const [ruleNotes, setRuleNotes] = React.useState('');

  // Simulator state
  const [simChannelType, setSimChannelType] = React.useState<'branch' | 'reseller'>('reseller');
  const [simEntityId, setSimEntityId] = React.useState<number | ''>('');
  const [simPackageId, setSimPackageId] = React.useState<number | ''>('');
  const [simDuration, setSimDuration] = React.useState<number>(1);
  const [simResult, setSimResult] = React.useState<any>(null);
  const [simulating, setSimulating] = React.useState(false);

  const fetchDependencies = async () => {
    try {
      setLoading(true);
      const [rulesRes, brRes, resRes, pkgRes] = await Promise.all([
        fetch('/api/pricing-rules'),
        fetch('/api/branches'),
        fetch('/api/resellers'),
        fetch('/api/packages'),
      ]);

      if (rulesRes.ok) {
        const json = await rulesRes.json();
        setRules(json.data || []);
      }
      if (brRes.ok) {
        const json = await brRes.json();
        setBranches(json.data || []);
      }
      if (resRes.ok) {
        const json = await resRes.json();
        setResellers(json.data || []);
      }
      if (pkgRes.ok) {
        const json = await pkgRes.json();
        setPackages(json.data || []);
        if (json.data?.[0]) {
          setSimPackageId(json.data[0].id);
        }
      }
    } catch {
      setError('Failed to load pricing configuration');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchDependencies();
  }, []);

  // Update simulator when inputs change
  React.useEffect(() => {
    const runSimulation = async () => {
      if (!simPackageId || !simEntityId) return;
      try {
        setSimulating(true);
        const res = await fetch('/api/pricing/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            packageId: Number(simPackageId),
            durationMonths: Number(simDuration),
            channelType: simChannelType,
            entityId: Number(simEntityId),
          }),
        });
        if (res.ok) {
          const json = await res.json();
          setSimResult(json.data);
        }
      } catch {
        // ignore
      } finally {
        setSimulating(false);
      }
    };

    runSimulation();
  }, [simChannelType, simEntityId, simPackageId, simDuration]);

  // Set default sim entity when dependencies load
  React.useEffect(() => {
    if (simChannelType === 'reseller' && resellers.length > 0 && !simEntityId) {
      setSimEntityId(resellers[0].id);
    } else if (simChannelType === 'branch' && branches.length > 0 && !simEntityId) {
      setSimEntityId(branches[0].id);
    }
  }, [simChannelType, resellers, branches]);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(ruleValue);
    if (isNaN(val) || val < 0) {
      setError('Value must be a valid positive number');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const res = await fetch('/api/pricing-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rule_name: ruleName.trim(),
          channel_type: channelType,
          branch_id: channelType === 'branch' && targetEntityId ? Number(targetEntityId) : null,
          reseller_id: channelType === 'reseller' && targetEntityId ? Number(targetEntityId) : null,
          package_id: targetPackageId ? Number(targetPackageId) : null,
          duration_months: targetDuration ? Number(targetDuration) : null,
          rule_type: ruleType,
          value: val,
          notes: ruleNotes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to create rule');
      }

      setCreateModalOpen(false);
      setRuleName('');
      setTargetEntityId('');
      setTargetPackageId('');
      setTargetDuration('');
      setRuleValue('');
      setRuleNotes('');
      fetchDependencies();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (id: number) => {
    if (!confirm('Are you sure you want to delete this pricing rule?')) return;
    try {
      const res = await fetch(`/api/pricing-rules/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRules(rules.filter((r) => r.id !== id));
      }
    } catch {
      setError('Failed to delete pricing rule');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Percent className="w-5 h-5 text-emerald-400" />
            Channel Pricing & Commission Rules
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hierarchical percentage discounts, commissions, fixed overrides, and duration multipliers
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 hover:opacity-90 transition-opacity flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Pricing Rule</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Simulator Section */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="w-4 h-4 text-primary" />
          <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Live Channel Price Simulator
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Channel Type</label>
            <select
              value={simChannelType}
              onChange={(e) => {
                setSimChannelType(e.target.value as any);
                setSimEntityId('');
              }}
              className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="reseller">Reseller Partner</option>
              <option value="branch">Branch Location</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Select {simChannelType === 'reseller' ? 'Reseller' : 'Branch'}
            </label>
            <select
              value={simEntityId}
              onChange={(e) => setSimEntityId(e.target.value ? Number(e.target.value) : '')}
              className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">-- Choose Entity --</option>
              {simChannelType === 'reseller'
                ? resellers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code})
                    </option>
                  ))
                : branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Package Plan</label>
            <select
              value={simPackageId}
              onChange={(e) => setSimPackageId(e.target.value ? Number(e.target.value) : '')}
              className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.rate_limit}) - NPR {p.price}/mo
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Duration</label>
            <select
              value={simDuration}
              onChange={(e) => setSimDuration(Number(e.target.value))}
              className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value={1}>1 Month (Standard)</option>
              <option value={3}>3 Months (Quarterly)</option>
              <option value={6}>6 Months (Semi-Annual)</option>
              <option value={12}>12 Months (Annual)</option>
            </select>
          </div>
        </div>

        {/* Simulator Calculation Output */}
        {simResult && (
          <div className="mt-4 p-4 rounded-xl bg-muted/40 border border-border grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Standard Retail Price</span>
              <span className="font-mono font-bold text-foreground text-sm">
                Rs. {Number(simResult.originalPrice).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Channel Net Price</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                Rs. {Number(simResult.channelPrice).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                {simChannelType === 'reseller' ? 'Reseller Margin / Comm' : 'Branch Discount'}
              </span>
              <span className="font-mono font-bold text-amber-400 text-sm">
                Rs. {Number(simResult.discountOrCommission).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Rule Applied</span>
              <span className="text-[11px] font-medium text-foreground truncate block">
                {simResult.ruleApplied || 'Standard Full Retail'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Rules Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Active Channel Rules ({rules.length})
          </h2>
          <span className="text-[11px] text-muted-foreground">Precedence: Specific Entity & Package &gt; Channel Default</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
              <tr>
                <th className="py-3 px-4">Rule Name</th>
                <th className="py-3 px-4">Channel Type</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">Package Scope</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Rule Configuration</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground animate-pulse">
                    Loading pricing rules...
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No channel pricing rules configured yet. Standard retail applies.
                  </td>
                </tr>
              ) : (
                rules.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-foreground">
                      {r.rule_name}
                      {r.notes && <div className="text-[10px] text-muted-foreground font-normal">{r.notes}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] ${
                          r.channel_type === 'reseller'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}
                      >
                        {r.channel_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {r.branch_name || r.reseller_name || (
                        <span className="text-muted-foreground italic">All {r.channel_type}s</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {r.package_name ? (
                        <span className="font-semibold text-foreground">{r.package_name}</span>
                      ) : (
                        <span className="text-muted-foreground italic">All Packages</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {r.duration_months ? `${r.duration_months} mo` : <span className="text-muted-foreground italic">All Durations</span>}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                      {r.rule_type === 'percentage_discount'
                        ? `${r.value}% DISCOUNT`
                        : r.rule_type === 'percentage_commission'
                        ? `${r.value}% COMMISSION`
                        : r.rule_type === 'fixed_discount'
                        ? `Rs. ${r.value} OFF`
                        : `Rs. ${r.value} FIXED`}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteRule(r.id)}
                        className="p-1 rounded-lg border border-border hover:bg-rose-500/10 hover:text-rose-400 text-muted-foreground transition-colors"
                        title="Delete Rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Rule Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2.5">
                <Percent className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-foreground">New Channel Pricing Rule</h3>
              </div>
              <button onClick={() => setCreateModalOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Rule Name *</label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  required
                  placeholder="e.g. ABC Reseller 18% Annual Incentive"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Channel Type *</label>
                  <select
                    value={channelType}
                    onChange={(e) => {
                      setChannelType(e.target.value as any);
                      setTargetEntityId('');
                    }}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="reseller">Reseller</option>
                    <option value="branch">Branch</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Target Entity</label>
                  <select
                    value={targetEntityId}
                    onChange={(e) => setTargetEntityId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">All {channelType === 'reseller' ? 'Resellers' : 'Branches'}</option>
                    {channelType === 'reseller'
                      ? resellers.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} ({r.code})
                          </option>
                        ))
                      : branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.code})
                          </option>
                        ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Package Plan Scope</label>
                  <select
                    value={targetPackageId}
                    onChange={(e) => setTargetPackageId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">All Packages</option>
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Duration Scope</label>
                  <select
                    value={targetDuration}
                    onChange={(e) => setTargetDuration(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">All Durations</option>
                    <option value={1}>1 Month</option>
                    <option value={3}>3 Months</option>
                    <option value={6}>6 Months</option>
                    <option value={12}>12 Months</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Pricing Model *</label>
                  <select
                    value={ruleType}
                    onChange={(e) => setRuleType(e.target.value as any)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="percentage_discount">Percentage Discount (%)</option>
                    <option value="percentage_commission">Percentage Commission (%)</option>
                    <option value="fixed_discount">Fixed Amount Discount (Rs)</option>
                    <option value="fixed_override">Fixed Price Override (Rs)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Value *</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={ruleValue}
                    onChange={(e) => setRuleValue(e.target.value)}
                    required
                    placeholder="e.g. 15 for 15% or 150 for Rs. 150"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Notes</label>
                <textarea
                  value={ruleNotes}
                  onChange={(e) => setRuleNotes(e.target.value)}
                  rows={2}
                  placeholder="Terms or conditions for this pricing structure..."
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {saving ? 'Creating...' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
