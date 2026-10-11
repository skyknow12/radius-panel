'use client';

import React from 'react';
import {
  Server,
  Layers,
  Radio,
  PlusCircle,
  RefreshCw,
  History,
  Sliders,
  ChevronRight,
  Shield,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OltItem } from '@/types/olt';
import { OltInventoryView } from './olt/olt-inventory-view';
import { OltDetailsView } from './olt/olt-details-view';
import { OnuDiscoveryView } from './olt/onu-discovery-view';
import { RegisteredOnusView } from './olt/registered-onus-view';
import { OnuProvisioningWizard } from './olt/onu-provisioning-wizard';
import { OltSyncView } from './olt/olt-sync-view';
import { OltHistoryView } from './olt/olt-history-view';

export type OltSubTab =
  | 'inventory'
  | 'details'
  | 'discovery'
  | 'registered_onus'
  | 'provision'
  | 'sync'
  | 'history';

interface OltManagementViewProps {
  initialSubTab?: OltSubTab;
  initialOltId?: number;
  onOpenCustomer?: (customerId: number) => void;
  currentUser?: any;
}

export function OltManagementView({
  initialSubTab = 'inventory',
  initialOltId,
  onOpenCustomer,
  currentUser,
}: OltManagementViewProps) {
  const [activeSubTab, setActiveSubTab] = React.useState<OltSubTab>(initialSubTab);
  const [selectedOlt, setSelectedOlt] = React.useState<OltItem | null>(null);

  // Parameters to prefill provisioning wizard
  const [provisionParams, setProvisionParams] = React.useState<{
    oltId?: number;
    slot?: number;
    port?: number;
    sn?: string;
  }>({});

  // Sync if initialSubTab changes from parent URL
  React.useEffect(() => {
    if (initialSubTab && initialSubTab !== activeSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Navigate to Provisioning wizard with prefill
  const handleNavigateToProvision = (params?: {
    oltId?: number;
    slot?: number;
    port?: number;
    sn?: string;
  }) => {
    if (params) setProvisionParams(params);
    setActiveSubTab('provision');
  };

  // Navigate to details of an OLT
  const handleSelectOlt = (olt: OltItem) => {
    setSelectedOlt(olt);
    setActiveSubTab('details');
  };

  interface NavItem {
    id: OltSubTab;
    label: string;
    icon: React.ElementType;
    badge?: string;
  }

  const navItems: NavItem[] = [
    { id: 'inventory', label: 'OLT Inventory', icon: Server },
    { id: 'registered_onus', label: 'Registered ONUs', icon: Layers },
    { id: 'discovery', label: 'ONU Discovery (Autofind)', icon: Radio, badge: 'AUTO' },
    { id: 'provision', label: 'Provision ONU', icon: PlusCircle },
    { id: 'sync', label: 'Synchronization Engine', icon: RefreshCw },
    { id: 'history', label: 'Operation History', icon: History },
  ];

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Title if in Details View */}
      {activeSubTab === 'details' && selectedOlt ? (
        <OltDetailsView
          olt={selectedOlt}
          onBack={() => {
            setSelectedOlt(null);
            setActiveSubTab('inventory');
          }}
          onNavigateToProvision={(p) => handleNavigateToProvision(p)}
          currentUser={currentUser}
        />
      ) : (
        <>
          {/* Sub Navigation Bar */}
          <div className="border-b border-border bg-card/60 backdrop-blur-sm px-2 -mx-2 sm:mx-0 sm:px-4 rounded-xl shadow-xs">
            <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-2 no-scrollbar">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSubTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSubTab(item.id)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all select-none',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span
                        className={cn(
                          'text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase',
                          isActive ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sub View Content */}
          <div className="mt-2">
            {activeSubTab === 'inventory' && (
              <OltInventoryView
                onSelectOlt={handleSelectOlt}
                onNavigateToProvision={handleNavigateToProvision}
                onNavigateToDiscovery={(oltId) => {
                  setProvisionParams({ oltId });
                  setActiveSubTab('discovery');
                }}
                currentUser={currentUser}
              />
            )}

            {activeSubTab === 'registered_onus' && (
              <RegisteredOnusView
                onOpenCustomer={onOpenCustomer}
                currentUser={currentUser}
              />
            )}

            {activeSubTab === 'discovery' && (
              <OnuDiscoveryView
                initialOltId={provisionParams.oltId}
                onRegisterOnu={(params) => {
                  setProvisionParams({
                    oltId: params.oltId,
                    slot: params.slot,
                    port: params.port,
                    sn: params.sn,
                  });
                  setActiveSubTab('provision');
                }}
                currentUser={currentUser}
              />
            )}

            {activeSubTab === 'provision' && (
              <OnuProvisioningWizard
                initialOltId={provisionParams.oltId}
                initialSlot={provisionParams.slot}
                initialPort={provisionParams.port}
                initialSn={provisionParams.sn}
                onSuccess={() => {
                  setActiveSubTab('registered_onus');
                }}
                currentUser={currentUser}
              />
            )}

            {activeSubTab === 'sync' && (
              <OltSyncView
                onNavigateToOltDetails={handleSelectOlt}
                onNavigateToRegisteredOnus={() => setActiveSubTab('registered_onus')}
                currentUser={currentUser}
              />
            )}

            {activeSubTab === 'history' && (
              <OltHistoryView currentUser={currentUser} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
