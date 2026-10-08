'use client';

import React from 'react';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Wifi,
  Clock,
  AlertTriangle,
  Search,
  Monitor,
  Server,
  Radio,
  ShieldCheck,
  Layers,
  Activity,
  Network,
  Hash,
  History,
  DollarSign,
  CreditCard,
  Package,
  Wallet,
  Percent,
  FileText,
  FileBarChart,
  Building2,
  Store,
  Headphones,
  LifeBuoy,
  ShieldAlert,
  UserCheck,
  ChevronDown,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string, queryParams?: Record<string, string>) => void;
  collapsed: boolean;
  currentUser?: any;
  onNavigateNotice?: (name: string) => void;
}

export function Sidebar({
  activeTab,
  setActiveTab,
  collapsed,
  currentUser,
  onNavigateNotice,
}: SidebarProps) {
  // Collapsible section state with localStorage persistence
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('radius_sidebar_sections');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return {
      customers: true,
      network: true,
      finance: true,
      organization: true,
      support: true,
      users: true,
      reports: false,
      system: false,
    };
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('radius_sidebar_sections', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // RBAC Permission Check Helper
  const hasPermission = (required?: string | string[]) => {
    if (!required) return true;
    if (!currentUser) return true;
    if (currentUser.role === 'super_admin' || currentUser.role === 'admin') return true;
    if (
      Array.isArray(currentUser.roles) &&
      (currentUser.roles.includes('super_admin') || currentUser.roles.includes('admin'))
    ) {
      return true;
    }
    const userPerms = Array.isArray(currentUser.permissions) ? currentUser.permissions : [];
    if (userPerms.includes('*')) return true;
    const reqList = Array.isArray(required) ? required : [required];
    return reqList.some((p) => userPerms.includes(p));
  };

  // Helper to render individual navigation button
  const renderNavItem = (
    key: string,
    label: string,
    Icon: React.ElementType,
    badge?: string,
    permission?: string | string[]
  ) => {
    if (!hasPermission(permission)) return null;

    const isActive = activeTab === key;

    return (
      <button
        key={key}
        onClick={() => setActiveTab(key)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all group relative',
          isActive
            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold shadow-md shadow-purple-500/20'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
        )}
        title={collapsed ? label : undefined}
      >
        <Icon
          className={cn(
            'w-4 h-4 flex-shrink-0 transition-colors',
            isActive ? 'text-white' : 'text-muted-foreground group-hover:text-primary'
          )}
        />
        {!collapsed && (
          <span className="flex items-center justify-between w-full truncate">
            <span className="truncate">{label}</span>
            {badge && (
              <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-semibold uppercase flex-shrink-0 ml-1">
                {badge}
              </span>
            )}
          </span>
        )}
      </button>
    );
  };

  // Helper to render a collapsible business section
  const renderSection = (
    key: string,
    title: string,
    icon: React.ElementType,
    children: React.ReactNode,
    sectionPermission?: string | string[]
  ) => {
    if (!hasPermission(sectionPermission)) return null;
    const isOpen = openSections[key] ?? true;

    return (
      <div key={key} className="space-y-1">
        {!collapsed ? (
          <button
            onClick={() => toggleSection(key)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 hover:text-foreground rounded-lg transition-colors select-none"
          >
            <div className="flex items-center gap-1.5 truncate">
              {React.createElement(icon, { className: 'w-3 h-3 text-primary flex-shrink-0' })}
              <span className="truncate">{title}</span>
            </div>
            <ChevronDown
              className={cn(
                'w-3 h-3 text-muted-foreground transition-transform duration-200 flex-shrink-0',
                isOpen ? 'rotate-0' : '-rotate-90'
              )}
            />
          </button>
        ) : (
          <div className="h-px bg-border my-2 mx-1" title={title} />
        )}

        {(isOpen || collapsed) && <div className="space-y-0.5">{children}</div>}
      </div>
    );
  };

  return (
    <aside
      className={cn(
        'border-r border-border bg-card/60 backdrop-blur-xl flex flex-col transition-all duration-300 z-20 select-none flex-shrink-0',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center px-4 border-b border-border/80 gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 via-indigo-600 to-primary flex items-center justify-center text-white font-bold shadow-lg shadow-purple-500/20 flex-shrink-0">
          <Zap className="w-5 h-5 fill-white/20 stroke-[2.5]" />
        </div>
        {!collapsed && (
          <div className="flex flex-col overflow-hidden">
            <span className="font-bold tracking-tight text-foreground text-sm uppercase flex items-center gap-1.5">
              SKY RADIUS
              <span className="text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded border border-primary/20">
                PRO
              </span>
            </span>
            <span className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase">
              ISP Operations
            </span>
          </div>
        )}
      </div>

      {/* Nav List grouped by Business Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {/* 1. DASHBOARD & NOC */}
        <div className="space-y-0.5">
          {renderNavItem('dashboard', 'Dashboard', LayoutDashboard, undefined, 'dashboard.view')}
          {renderNavItem('noc_dashboard', 'NOC Operations', Monitor, 'LIVE', ['radius.view', 'network.events'])}
        </div>

        {/* 2. CUSTOMERS */}
        {renderSection(
          'customers',
          'CUSTOMERS',
          Users,
          <>
            {renderNavItem('create_customer', 'Create New Customer', UserPlus, undefined, 'subscriber.create')}
            {renderNavItem('subscribers', 'Total Customers', Users, undefined, 'subscriber.view')}
            {renderNavItem('online_customers', 'Online Customers', Wifi, 'Live', 'subscriber.view')}
            {renderNavItem('customers_expired', 'Expired Customers', AlertTriangle, undefined, 'subscriber.view')}
            {renderNavItem('customers_dashboard', 'Customer Dashboard', LayoutDashboard, undefined, 'subscriber.view')}
          </>,
          'subscriber.view'
        )}

        {/* 3. NETWORK */}
        {renderSection(
          'network',
          'NETWORK',
          Monitor,
          <>
            {renderNavItem('nas_devices', 'NAS / BNG Gateways', Server, undefined, 'radius.view')}
            {renderNavItem('radius_overview', 'RADIUS Overview', Radio, undefined, 'radius.view')}
            {renderNavItem('radius_profiles', 'RADIUS Profiles', ShieldCheck, undefined, 'radius.view')}
            {renderNavItem('sessions', 'Online Sessions', Layers, undefined, 'radius.view')}
            {renderNavItem('auth_logs', 'Authentication Logs', Activity, undefined, 'radius.view')}
            {renderNavItem('ip_pools', 'IP Pools', Network, undefined, 'radius.view')}
            {renderNavItem('ip_addresses', 'IP Addresses', Hash, undefined, 'radius.view')}
            {renderNavItem('network_events', 'Network Events', History, undefined, 'network.events')}
            {renderNavItem('alerts', 'System Alerts', AlertTriangle, undefined, 'alerts.view')}
          </>,
          'radius.view'
        )}

        {/* 4. FINANCE & BILLING */}
        {renderSection(
          'finance',
          'FINANCE & BILLING',
          DollarSign,
          <>
            {renderNavItem('billing_dashboard', 'Finance Dashboard', DollarSign, undefined, 'billing.view')}
            {renderNavItem('billing_transactions', 'Transactions & Receipts', CreditCard, undefined, 'billing.view')}
            {renderNavItem('billing_expiry', 'Expiry & Renewals', Clock, undefined, 'billing.view')}
            {renderNavItem('packages', 'Packages & Pricing', Package, undefined, ['package.view', 'billing.view'])}
            {renderNavItem('wallets', 'Wallets & Credit', Wallet, undefined, 'billing.view')}
            {renderNavItem('channel_pricing', 'Channel Pricing', Percent, undefined, 'billing.view')}
            {renderNavItem('commission_report', 'Reseller Commission', FileText, undefined, 'billing.view')}
            {renderNavItem('payment_methods', 'Payment Gateways', CreditCard, undefined, 'billing.view')}
            {renderNavItem('billing_reports', 'Financial Reports', FileBarChart, undefined, ['billing.report', 'billing.view'])}
          </>,
          'billing.view'
        )}

        {/* 5. ORGANIZATION */}
        {renderSection(
          'organization',
          'ORGANIZATION',
          Building2,
          <>
            {renderNavItem('organization_dashboard', 'Organization Dashboard', Building2, undefined, 'organization.view')}
            {renderNavItem('branches', 'Branch Offices', Store, undefined, 'branch.view')}
            {renderNavItem('resellers', 'Resellers & Partners', Users, undefined, 'reseller.view')}
          </>,
          ['organization.view', 'branch.view', 'reseller.view']
        )}

        {/* 6. SUPPORT & CRM */}
        {renderSection(
          'support',
          'SUPPORT & CRM',
          LifeBuoy,
          <>
            {renderNavItem('crm', 'Customer CRM Directory', Headphones, undefined, 'crm.view')}
            {renderNavItem('tickets', 'Support Tickets', LifeBuoy, undefined, 'tickets.view')}
            {renderNavItem('sla_rules', 'SLA Policies', ShieldAlert, undefined, ['tickets.view', 'settings.view'])}
          </>,
          ['crm.view', 'tickets.view']
        )}

        {/* 7. USER MANAGEMENT */}
        {renderSection(
          'users',
          'USER MANAGEMENT',
          UserCheck,
          <>
            {renderNavItem('users', 'Staff Users & Governance', UserCheck, undefined, 'users.view')}
            {renderNavItem('roles', 'Roles & Permissions', ShieldCheck, undefined, 'roles.view')}
          </>,
          ['users.view', 'roles.view']
        )}

        {/* 8. REPORTS */}
        {renderSection(
          'reports',
          'REPORTS',
          FileBarChart,
          <>
            {renderNavItem('reports', 'Centralized Reports Hub', FileBarChart, undefined, ['reports.view', 'billing.report'])}
          </>,
          ['reports.view', 'billing.report']
        )}

        {/* 9. SYSTEM */}
        {renderSection(
          'system',
          'SYSTEM',
          Activity,
          <>
            {renderNavItem('system_health', 'System Health & Probes', Activity, undefined, 'settings.view')}
            {renderNavItem('audit_logs', 'Audit Trail Logs', History, undefined, 'audit_logs.view')}
          </>,
          ['settings.view', 'audit_logs.view']
        )}
      </div>

      {/* Footer User Info */}
      {!collapsed && currentUser && (
        <div className="p-3 border-t border-border/80 bg-card/40 flex items-center justify-between text-xs">
          <div className="truncate">
            <span className="font-semibold text-foreground truncate block">
              {currentUser.fullName || currentUser.username}
            </span>
            <span className="text-[10px] text-muted-foreground uppercase font-mono">
              {currentUser.role || 'Staff User'}
            </span>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" title="Connected" />
        </div>
      )}
    </aside>
  );
}
