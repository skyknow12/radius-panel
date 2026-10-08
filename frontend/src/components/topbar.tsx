'use client';

import React from 'react';
import {
  Menu,
  Search,
  Bell,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  User,
  LogOut,
  Shield,
  Activity,
} from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import type { ServiceHealth } from '@/types/api';

interface TopbarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  systemHealth: { status: string; services: ServiceHealth[] } | null;
  currentUser?: { username: string; roleDisplay?: string } | null;
  onLogout?: () => void;
  onOpenTestModal?: () => void;
  onOpenSearch?: () => void;
}

export function Topbar({
  collapsed,
  setCollapsed,
  systemHealth,
  currentUser,
  onLogout,
  onOpenTestModal,
  onOpenSearch,
}: TopbarProps) {
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [unreadCount, setUnreadCount] = React.useState<number>(0);

  const fetchNotifications = async () => {
    try {
      const [resList, resCount] = await Promise.all([
        fetch('/api/notifications?limit=10'),
        fetch('/api/notifications/unread-count'),
      ]);
      if (resList.ok) {
        const jsonList = await resList.json();
        setNotifications(jsonList.data || []);
      }
      if (resCount.ok) {
        const jsonCount = await resCount.json();
        setUnreadCount(jsonCount.data?.count || 0);
      }
    } catch {}
  };

  React.useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 25000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications/mark-all-read', { method: 'POST' });
      setUnreadCount(0);
      fetchNotifications();
    } catch {}
  };

  const handleMarkRead = async (id: number) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      fetchNotifications();
    } catch {}
  };

  const isHealthy = systemHealth?.status === 'healthy';
  const isWarning = systemHealth?.status === 'degraded';

  return (
    <header className="h-16 border-b border-border bg-card/70 backdrop-blur-md px-4 flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Left: Sidebar Collapse & Global Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted border border-border/80 transition-colors"
          title="Toggle sidebar"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Global Search Dialog trigger */}
        <div
          role="button"
          tabIndex={0}
          onClick={onOpenSearch}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onOpenSearch?.();
          }}
          className="relative w-full max-w-sm hidden sm:flex items-center bg-muted/60 hover:bg-muted/90 border border-border rounded-lg pl-9 pr-2.5 py-1.5 text-xs text-muted-foreground cursor-pointer transition-all"
        >
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <span className="truncate">Search subscriber, IP, MAC, NAS...</span>
          <kbd className="ml-auto pointer-events-none inline-flex h-4.5 select-none items-center gap-0.5 rounded border border-border bg-card px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </div>

        <button
          onClick={onOpenSearch}
          className="sm:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted border border-border/80"
          title="Search"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5">
        {/* RADIUS Interactive Test Button */}
        <button
          onClick={onOpenTestModal}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors"
          title="Test RADIUS Authentication"
        >
          <Activity className="w-3.5 h-3.5" />
          <span>radtest Probe</span>
        </button>

        {/* Live System Status Indicator */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/80 text-xs shadow-sm">
          {isHealthy ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-emerald-500 font-medium">System Healthy</span>
            </>
          ) : isWarning ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-amber-500 font-medium">System Degraded</span>
            </>
          ) : (
            <>
              <XCircle className="w-3.5 h-3.5 text-rose-500" />
              <span className="text-rose-500 font-medium">FreeRADIUS Offline</span>
            </>
          )}
        </div>

        {/* Notification Icon */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="w-9 h-9 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors relative"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 min-w-[18px] h-4.5 bg-rose-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center ring-2 ring-card shadow-sm animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-border bg-card p-3 shadow-xl z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-border font-medium">
                <span className="font-bold text-foreground">Notifications</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{unreadCount} unread</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[10px] text-primary hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
              </div>
              <div className="py-2 space-y-2 max-h-72 overflow-y-auto pr-1">
                {notifications.length > 0 ? (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleMarkRead(n.id)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition ${
                        !n.is_read
                          ? 'bg-primary/5 border-primary/20 text-foreground'
                          : 'bg-muted/40 border-border/60 text-muted-foreground'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground text-xs">{n.title}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] mt-0.5 text-muted-foreground line-clamp-2">{n.message}</p>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-center text-xs text-muted-foreground">No recent notifications</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme Switcher */}
        <ThemeToggle />

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg border border-border bg-card hover:bg-muted transition-colors text-left"
          >
            <div className="w-7 h-7 rounded-md bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-xs">
              {currentUser?.username?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="hidden xl:flex flex-col text-xs leading-none pr-1">
              <span className="font-semibold text-foreground">{currentUser?.username || 'admin'}</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">
                {currentUser?.roleDisplay || 'Super Admin'}
              </span>
            </div>
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card p-2 shadow-xl z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-2 border-b border-border/80">
                <p className="font-semibold text-foreground">{currentUser?.username || 'Administrator'}</p>
                <p className="text-[11px] text-muted-foreground">NOC Engineering Team</p>
              </div>
              <div className="py-1">
                <div className="flex items-center gap-2 px-3 py-1.5 text-muted-foreground hover:bg-muted rounded-md cursor-pointer">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Security & Roles</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 text-muted-foreground hover:bg-muted rounded-md cursor-pointer">
                  <User className="w-3.5 h-3.5" />
                  <span>Account Settings</span>
                </div>
              </div>
              <div className="pt-1 border-t border-border/80">
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
