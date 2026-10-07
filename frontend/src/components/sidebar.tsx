'use client';

import React from 'react';
import {
  LayoutDashboard,
  Radio,
  Network,
  Users,
  Box,
  CreditCard,
  FileBarChart,
  Activity,
  Settings,
  ChevronDown,
  Layers,
  Server,
  Zap,
  Monitor,
  Bell,
  AlertTriangle,
  History,
  DollarSign,
  FileText,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsed: boolean;
  onNavigateNotice?: (name: string) => void;
}

export function Sidebar({ activeTab, setActiveTab, collapsed, onNavigateNotice }: SidebarProps) {
  const [radiusOpen, setRadiusOpen] = React.useState(true);
  const [networkOpen, setNetworkOpen] = React.useState(true);
  const [managementOpen, setManagementOpen] = React.useState(true);
  const [billingOpen, setBillingOpen] = React.useState(true);
  const [systemOpen, setSystemOpen] = React.useState(true);

  const handleNextModule = (title: string) => {
    if (onNavigateNotice) onNavigateNotice(title);
  };

  return (
    <aside
      className={cn(
        'border-r border-border bg-card/60 backdrop-blur-xl flex flex-col transition-all duration-300 z-20 select-none flex-shrink-0',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Brand Logo & Subtitle */}
      <div className="h-16 flex items-center px-4 border-b border-border/80 gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 via-indigo-600 to-primary flex items-center justify-center text-white font-bold shadow-lg shadow-purple-500/20 flex-shrink-0">
          <Zap className="w-5 h-5 fill-white/20 stroke-[2.5]" />
        </div>
        {!collapsed && (
          <div className="flex flex-col overflow-hidden">
            <span className="font-bold tracking-tight text-foreground text-sm uppercase flex items-center gap-1.5">
              RADIUS PRO
              <span className="text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded border border-primary/20">
                v1.0
              </span>
            </span>
            <span className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase">
              ISP Management
            </span>
          </div>
        )}
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {/* Dashboard */}
        <div>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
              activeTab === 'dashboard'
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
            title="Dashboard"
          >
            <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Dashboard</span>}
          </button>

          <button
            onClick={() => setActiveTab('noc_dashboard')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group mt-1',
              activeTab === 'noc_dashboard'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
            title="NOC Operations"
          >
            <Monitor className="w-4 h-4 flex-shrink-0 text-cyan-400" />
            {!collapsed && (
              <span className="flex items-center justify-between w-full">
                <span>NOC Operations</span>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.2 rounded font-semibold uppercase">Live</span>
              </span>
            )}
          </button>
        </div>

        {/* RADIUS GROUP */}
        <div>
          {!collapsed ? (
            <div
              onClick={() => setRadiusOpen(!radiusOpen)}
              className="flex items-center justify-between text-xs font-semibold text-muted-foreground/80 tracking-wider uppercase px-3 py-1 cursor-pointer hover:text-foreground"
            >
              <span className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-primary" /> RADIUS
              </span>
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', !radiusOpen && '-rotate-90')} />
            </div>
          ) : (
            <div className="h-px bg-border my-2" />
          )}

          {(!collapsed ? radiusOpen : true) && (
            <div className="mt-1 space-y-0.5">
              <button
                onClick={() => setActiveTab('radius_overview')}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                  activeTab === 'radius_overview'
                    ? 'bg-primary/15 text-primary font-semibold border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
                title="RADIUS Overview"
              >
                <Radio className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>Overview</span>}
              </button>

              <button
                onClick={() => setActiveTab('radius_profiles')}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                  activeTab === 'radius_profiles'
                    ? 'bg-primary/15 text-primary font-semibold border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
                title="RADIUS Profiles"
              >
                <Layers className="w-4 h-4 flex-shrink-0 text-primary" />
                {!collapsed && <span>RADIUS Profiles</span>}
              </button>

              <button
                onClick={() => setActiveTab('sessions')}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                  activeTab === 'sessions'
                    ? 'bg-primary/15 text-primary font-semibold border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
                title="Online Sessions"
              >
                <Users className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>Online Sessions</span>}
              </button>

              <button
                onClick={() => setActiveTab('auth_logs')}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                  activeTab === 'auth_logs'
                    ? 'bg-primary/15 text-primary font-semibold border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
                title="Authentication Logs"
              >
                <Activity className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>Auth Logs</span>}
              </button>
            </div>
          )}
        </div>

        {/* NETWORK GROUP */}
        <div>
          {!collapsed ? (
            <div
              onClick={() => setNetworkOpen(!networkOpen)}
              className="flex items-center justify-between text-xs font-semibold text-muted-foreground/80 tracking-wider uppercase px-3 py-1 cursor-pointer hover:text-foreground"
            >
              <span className="flex items-center gap-1.5">
                <Network className="w-3.5 h-3.5 text-blue-500" /> NETWORK
              </span>
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', !networkOpen && '-rotate-90')} />
            </div>
          ) : (
            <div className="h-px bg-border my-2" />
          )}

          {(!collapsed ? networkOpen : true) && (
            <div className="mt-1 space-y-0.5">
              <button
                onClick={() => setActiveTab('nas_devices')}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                  activeTab === 'nas_devices'
                    ? 'bg-primary/15 text-primary font-semibold border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
                title="NAS Devices"
              >
                <Server className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>NAS Devices</span>}
              </button>

              <button
                onClick={() => setActiveTab('ip_pools')}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                  activeTab === 'ip_pools'
                    ? 'bg-primary/15 text-primary font-semibold border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
                title="IP Pools"
              >
                <Box className="w-4 h-4 flex-shrink-0 text-blue-400" />
                {!collapsed && <span>IP Pools</span>}
              </button>

              <button
                onClick={() => setActiveTab('ip_addresses')}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                  activeTab === 'ip_addresses'
                    ? 'bg-primary/15 text-primary font-semibold border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
                title="IP Addresses"
              >
                <Network className="w-4 h-4 flex-shrink-0 text-cyan-400" />
                {!collapsed && <span>IP Addresses</span>}
              </button>

              <button
                onClick={() => setActiveTab('network_events')}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                  activeTab === 'network_events'
                    ? 'bg-primary/15 text-primary font-semibold border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
                title="Network Events Log"
              >
                <History className="w-4 h-4 flex-shrink-0 text-amber-400" />
                {!collapsed && <span>Network Events</span>}
              </button>

              <button
                onClick={() => setActiveTab('alerts')}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                  activeTab === 'alerts'
                    ? 'bg-primary/15 text-primary font-semibold border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
                title="NOC Alerts"
              >
                <Bell className="w-4 h-4 flex-shrink-0 text-rose-400" />
                {!collapsed && <span>NOC Alerts</span>}
              </button>
            </div>
          )}
        </div>

        {/* MANAGEMENT GROUP */}
        <div>
          {!collapsed ? (
            <div
              onClick={() => setManagementOpen(!managementOpen)}
              className="flex items-center justify-between text-xs font-semibold text-muted-foreground/80 tracking-wider uppercase px-3 py-1 cursor-pointer hover:text-foreground"
            >
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-500" /> MANAGEMENT
              </span>
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', !managementOpen && '-rotate-90')} />
            </div>
          ) : (
            <div className="h-px bg-border my-2" />
          )}

          {(!collapsed ? managementOpen : true) && (
            <div className="mt-1 space-y-0.5">
              <button
                onClick={() => setActiveTab('subscribers')}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                  activeTab === 'subscribers'
                    ? 'bg-primary/15 text-primary font-semibold border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
                title="Subscribers"
              >
                <Users className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>Subscribers</span>}
              </button>

              <button
                onClick={() => setActiveTab('packages')}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                  activeTab === 'packages'
                    ? 'bg-primary/15 text-primary font-semibold border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
                title="Service Packages"
              >
                <Box className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>Packages</span>}
              </button>
            </div>
          )}
        </div>

        {/* BILLING & FINANCE GROUP */}
        <div>
          {!collapsed ? (
            <div
              onClick={() => setBillingOpen(!billingOpen)}
              className="flex items-center justify-between text-xs font-semibold text-muted-foreground/80 tracking-wider uppercase px-3 py-1 cursor-pointer hover:text-foreground"
            >
              <span className="flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-primary" /> BILLING & FINANCE
              </span>
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', !billingOpen && '-rotate-90')} />
            </div>
          ) : (
            <div className="h-px bg-border my-2" />
          )}

          {(!collapsed ? billingOpen : true) && (
            <div className="mt-1 space-y-0.5">
              <button
                onClick={() => setActiveTab('billing_dashboard')}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                  activeTab === 'billing_dashboard'
                    ? 'bg-primary/15 text-primary font-semibold border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
                title="Billing Dashboard"
              >
                <DollarSign className="w-4 h-4 flex-shrink-0 text-emerald-500" />
                {!collapsed && <span>Billing Dashboard</span>}
              </button>

              <button
                onClick={() => setActiveTab('billing_transactions')}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                  activeTab === 'billing_transactions'
                    ? 'bg-primary/15 text-primary font-semibold border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
                title="Transactions & Ledger"
              >
                <FileText className="w-4 h-4 flex-shrink-0 text-primary" />
                {!collapsed && <span>Transactions</span>}
              </button>

              <button
                onClick={() => setActiveTab('billing_expiry')}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                  activeTab === 'billing_expiry'
                    ? 'bg-primary/15 text-primary font-semibold border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
                title="Expiry Management"
              >
                <Clock className="w-4 h-4 flex-shrink-0 text-rose-400" />
                {!collapsed && <span>Expiry Management</span>}
              </button>

              <button
                onClick={() => setActiveTab('payment_methods')}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                  activeTab === 'payment_methods'
                    ? 'bg-primary/15 text-primary font-semibold border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
                title="Payment Channels"
              >
                <CreditCard className="w-4 h-4 flex-shrink-0 text-indigo-400" />
                {!collapsed && <span>Payment Channels</span>}
              </button>

              <button
                onClick={() => setActiveTab('billing_reports')}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                  activeTab === 'billing_reports'
                    ? 'bg-primary/15 text-primary font-semibold border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
                title="Financial Reports"
              >
                <FileBarChart className="w-4 h-4 flex-shrink-0 text-amber-400" />
                {!collapsed && <span>Financial Reports</span>}
              </button>
            </div>
          )}
        </div>

        {/* REPORTS */}
        <div>
          <button
            onClick={() => setActiveTab('reports')}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors',
              activeTab === 'reports'
                ? 'bg-primary/15 text-primary font-semibold border border-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
            title="Reports & Analytics"
          >
            <div className="flex items-center gap-3">
              <FileBarChart className="w-4 h-4 flex-shrink-0 text-emerald-400" />
              {!collapsed && <span>Reports & Export</span>}
            </div>
            {!collapsed && <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 rounded font-medium">CSV</span>}
          </button>
        </div>

        {/* SYSTEM */}
        <div>
          {!collapsed ? (
            <div
              onClick={() => setSystemOpen(!systemOpen)}
              className="flex items-center justify-between text-xs font-semibold text-muted-foreground/80 tracking-wider uppercase px-3 py-1 cursor-pointer hover:text-foreground"
            >
              <span className="flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-orange-500" /> SYSTEM
              </span>
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', !systemOpen && '-rotate-90')} />
            </div>
          ) : (
            <div className="h-px bg-border my-2" />
          )}

          {(!collapsed ? systemOpen : true) && (
            <div className="mt-1 space-y-0.5">
              <button
                onClick={() => handleNextModule('System Health Diagnostics')}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground/70 hover:text-foreground hover:bg-muted"
              >
                <div className="flex items-center gap-3">
                  <Activity className="w-4 h-4 flex-shrink-0 text-emerald-500" />
                  {!collapsed && <span>System Health</span>}
                </div>
                {!collapsed && <span className="text-[10px] text-emerald-500/80 font-mono">Live</span>}
              </button>

              <button
                onClick={() => handleNextModule('System Settings')}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground/70 hover:text-foreground hover:bg-muted"
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && <span>Settings</span>}
                </div>
                {!collapsed && <span className="text-[10px] text-muted-foreground/60">Soon</span>}
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
