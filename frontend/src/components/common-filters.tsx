'use client';

import React from 'react';
import {
  Calendar,
  Filter,
  X,
  Search,
  Building2,
  Store,
  Package,
  Layers,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';

export type TimePeriodPreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'custom'
  | 'all';

export interface FilterState {
  period?: TimePeriodPreset;
  dateFrom?: string;
  dateTo?: string;
  branch?: string;
  resellerId?: string;
  packageId?: string;
  status?: string;
  search?: string;
  paymentMethod?: string;
  connectionType?: string;
}

export interface OptionItem {
  id: string | number;
  name: string;
}

export interface CommonFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onReset?: () => void;
  showPeriod?: boolean;
  showCustomDates?: boolean;
  showBranch?: boolean;
  showReseller?: boolean;
  showPackage?: boolean;
  showStatus?: boolean;
  showSearch?: boolean;
  showPaymentMethod?: boolean;
  showConnectionType?: boolean;
  statusOptions?: { value: string; label: string }[];
  searchPlaceholder?: string;
  branchOptions?: OptionItem[];
  resellerOptions?: OptionItem[];
  packageOptions?: OptionItem[];
  paymentMethodOptions?: OptionItem[];
  className?: string;
}

export const PERIOD_LABELS: Record<TimePeriodPreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This Week',
  last_week: 'Last Week',
  this_month: 'This Month',
  last_month: 'Last Month',
  this_year: 'This Year',
  custom: 'Custom Range',
  all: 'All Time',
};

export function CommonFilters({
  filters,
  onChange,
  onReset,
  showPeriod = true,
  showBranch = false,
  showReseller = false,
  showPackage = false,
  showStatus = false,
  showSearch = false,
  showPaymentMethod = false,
  showConnectionType = false,
  statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'active', label: 'Active' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'expired', label: 'Expired' },
  ],
  searchPlaceholder = 'Search records...',
  branchOptions = [],
  resellerOptions = [],
  packageOptions = [],
  paymentMethodOptions = [],
  className = '',
}: CommonFiltersProps) {
  const [mobileExpanded, setMobileExpanded] = React.useState(false);

  const handlePeriodChange = (period: TimePeriodPreset) => {
    const next: FilterState = { ...filters, period };
    if (period !== 'custom') {
      next.dateFrom = undefined;
      next.dateTo = undefined;
    }
    onChange(next);
  };

  const handleClear = () => {
    if (onReset) {
      onReset();
    } else {
      onChange({
        period: 'today',
        dateFrom: undefined,
        dateTo: undefined,
        branch: 'all',
        resellerId: 'all',
        packageId: 'all',
        status: 'all',
        search: '',
      });
    }
  };

  const hasActiveFilters =
    (filters.period && filters.period !== 'today' && filters.period !== 'all') ||
    filters.dateFrom ||
    filters.dateTo ||
    (filters.branch && filters.branch !== 'all') ||
    (filters.resellerId && filters.resellerId !== 'all') ||
    (filters.packageId && filters.packageId !== 'all') ||
    (filters.status && filters.status !== 'all') ||
    (filters.search && filters.search.trim().length > 0);

  return (
    <div className={`p-4 rounded-2xl border border-border bg-card/70 backdrop-blur-md shadow-sm space-y-3 ${className}`}>
      {/* Top Bar / Search & Mobile Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {showSearch && (
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={filters.search || ''}
              onChange={(e) => onChange({ ...filters, search: e.target.value })}
              placeholder={searchPlaceholder}
              className="w-full bg-muted/50 border border-border rounded-xl pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
            />
            {filters.search && (
              <button
                onClick={() => onChange({ ...filters, search: '' })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Quick Period Buttons on Desktop */}
        {showPeriod && (
          <div className="hidden lg:flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border text-xs">
            {(
              [
                'today',
                'yesterday',
                'this_week',
                'this_month',
                'last_month',
                'this_year',
                'custom',
                'all',
              ] as TimePeriodPreset[]
            ).map((p) => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  filters.period === p
                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Mobile Period Dropdown */}
          {showPeriod && (
            <div className="lg:hidden">
              <select
                value={filters.period || 'today'}
                onChange={(e) => handlePeriodChange(e.target.value as TimePeriodPreset)}
                className="bg-card border border-border rounded-xl px-3 py-1.5 text-xs text-foreground font-medium"
              >
                {Object.entries(PERIOD_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Toggle additional filters on smaller screens */}
          {(showBranch || showReseller || showPackage || showStatus) && (
            <button
              onClick={() => setMobileExpanded(!mobileExpanded)}
              className="sm:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-medium text-muted-foreground"
            >
              <Filter className="w-3.5 h-3.5 text-primary" />
              <span>Filters</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${mobileExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}

          {hasActiveFilters && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border hover:bg-muted text-xs text-rose-500 font-medium transition-colors"
              title="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Custom Date Range Picker when Custom Period Selected */}
      {showPeriod && filters.period === 'custom' && (
        <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex flex-wrap items-center gap-3 text-xs animate-in fade-in">
          <div className="flex items-center gap-1.5 font-semibold text-primary">
            <Calendar className="w-4 h-4" />
            <span>Custom Date Range:</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-muted-foreground">From:</label>
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
              className="bg-card border border-border rounded-lg px-2.5 py-1 text-foreground font-mono focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-muted-foreground">To:</label>
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
              className="bg-card border border-border rounded-lg px-2.5 py-1 text-foreground font-mono focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      )}

      {/* Additional Dropdown Filters Bar (Branch, Reseller, Package, Status) */}
      <div
        className={`flex flex-wrap items-center gap-2.5 pt-1 ${
          mobileExpanded ? 'block' : 'hidden sm:flex'
        }`}
      >
        {/* Branch Filter */}
        {showBranch && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-primary" /> Branch:
            </span>
            <select
              value={filters.branch || 'all'}
              onChange={(e) => onChange({ ...filters, branch: e.target.value })}
              className="bg-card border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-medium focus:outline-none focus:border-primary"
            >
              <option value="all">All Branches</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Reseller Filter */}
        {showReseller && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <Store className="w-3.5 h-3.5 text-primary" /> Reseller:
            </span>
            <select
              value={filters.resellerId || 'all'}
              onChange={(e) => onChange({ ...filters, resellerId: e.target.value })}
              className="bg-card border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-medium focus:outline-none focus:border-primary"
            >
              <option value="all">All Resellers</option>
              {resellerOptions.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Package Filter */}
        {showPackage && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-primary" /> Plan:
            </span>
            <select
              value={filters.packageId || 'all'}
              onChange={(e) => onChange({ ...filters, packageId: e.target.value })}
              className="bg-card border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-medium focus:outline-none focus:border-primary"
            >
              <option value="all">All Packages</option>
              {packageOptions.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Status Filter */}
        {showStatus && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-primary" /> Status:
            </span>
            <select
              value={filters.status || 'all'}
              onChange={(e) => onChange({ ...filters, status: e.target.value })}
              className="bg-card border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-medium focus:outline-none focus:border-primary"
            >
              {statusOptions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Payment Method Filter */}
        {showPaymentMethod && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground font-medium">Payment:</span>
            <select
              value={filters.paymentMethod || 'all'}
              onChange={(e) => onChange({ ...filters, paymentMethod: e.target.value })}
              className="bg-card border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-medium focus:outline-none focus:border-primary"
            >
              <option value="all">All Methods</option>
              {paymentMethodOptions.map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
