'use client';

import React from 'react';
import {
  Search,
  User,
  Server,
  Layers,
  Box,
  Network,
  ArrowRight,
  CreditCard,
  Building2,
  Store,
  Wallet,
  LifeBuoy,
  UserCheck,
  X,
} from 'lucide-react';
import type { GlobalSearchResult } from '@/types/api';

interface GlobalSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (tab: string) => void;
  onSelectSubscriber: (id: number) => void;
  onSelectNas?: () => void;
  onSelectPackage?: () => void;
}

export function GlobalSearchDialog({
  isOpen,
  onClose,
  onNavigate,
  onSelectSubscriber,
  onSelectNas,
  onSelectPackage,
}: GlobalSearchDialogProps) {
  const [query, setQuery] = React.useState<string>('');
  const [results, setResults] = React.useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = React.useState<number>(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const resultsContainerRef = React.useRef<HTMLDivElement>(null);

  // Focus input when opened and reset states
  React.useEffect(() => {
    if (isOpen) {
      setSelectedIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
      setSelectedIndex(-1);
    }
  }, [isOpen]);

  // Global ESC key listener to guarantee closing from anywhere
  React.useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [isOpen, onClose]);

  // Debounced search query
  React.useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setSelectedIndex(-1);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const json = await res.json();
          const items: GlobalSearchResult[] = json.data || [];
          setResults(items);
          setSelectedIndex(items.length > 0 ? 0 : -1);
        }
      } catch {
        // ignore network error
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Keep selected item in view when using arrow keys
  React.useEffect(() => {
    if (selectedIndex >= 0 && resultsContainerRef.current) {
      const activeEl = resultsContainerRef.current.children[selectedIndex] as HTMLElement | undefined;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const handleSelect = (item: GlobalSearchResult) => {
    onClose();
    if (item.type === 'subscriber') {
      onSelectSubscriber(Number(item.id));
    } else if (item.type === 'session') {
      onNavigate?.('sessions');
    } else if (item.type === 'nas') {
      if (onSelectNas) {
        onSelectNas();
      } else {
        onNavigate?.('nas_devices');
      }
    } else if (item.type === 'package') {
      if (onSelectPackage) {
        onSelectPackage();
      } else {
        onNavigate?.('packages');
      }
    } else if (item.type === 'ip') {
      onNavigate?.('ip_addresses');
    } else if (item.type === 'transaction' || item.type === 'invoice') {
      onNavigate?.('billing_transactions');
    } else if (item.type === 'branch') {
      onNavigate?.('branches');
    } else if (item.type === 'reseller') {
      onNavigate?.('resellers');
    } else if (item.type === 'wallet') {
      onNavigate?.('wallets');
    } else if (item.type === 'ticket') {
      onNavigate?.('tickets');
    } else if (item.type === 'user') {
      onNavigate?.('users');
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelect(results[selectedIndex]);
      } else if (results.length > 0) {
        handleSelect(results[0]);
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global Search"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-150 cursor-pointer"
      onClick={(e) => {
        // Clicking the backdrop closes the modal
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-border bg-card p-4 shadow-2xl animate-in zoom-in-95 duration-150 space-y-3 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/50 border border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search username, CID, IP, NAS, branch, reseller, wallet, Txn, ticket, user..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
          )}

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults([]);
                setSelectedIndex(-1);
                inputRef.current?.focus();
              }}
              className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Clear text"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Close / ESC Button */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-card hover:bg-muted text-[11px] text-muted-foreground hover:text-foreground font-mono transition-colors shrink-0 cursor-pointer shadow-sm"
            title="Close search (Esc)"
          >
            <span>ESC</span>
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>

        {/* Results List */}
        <div ref={resultsContainerRef} className="max-h-80 overflow-y-auto space-y-1">
          {query.length >= 2 && results.length === 0 && !loading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No matching records found for &quot;{query}&quot;.
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={idx}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-3 rounded-xl transition-all cursor-pointer flex items-center justify-between group ${
                    isSelected
                      ? 'bg-primary/10 border border-primary/30 shadow-xs'
                      : 'hover:bg-muted/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-primary/10 text-primary border-primary/20'
                      }`}
                    >
                      {item.type === 'subscriber' ? (
                        <User className="w-4 h-4" />
                      ) : item.type === 'session' ? (
                        <Layers className="w-4 h-4" />
                      ) : item.type === 'nas' ? (
                        <Server className="w-4 h-4" />
                      ) : item.type === 'package' ? (
                        <Box className="w-4 h-4" />
                      ) : item.type === 'branch' ? (
                        <Building2 className="w-4 h-4" />
                      ) : item.type === 'reseller' ? (
                        <Store className="w-4 h-4" />
                      ) : item.type === 'wallet' ? (
                        <Wallet className="w-4 h-4" />
                      ) : item.type === 'ticket' ? (
                        <LifeBuoy className="w-4 h-4" />
                      ) : item.type === 'user' ? (
                        <UserCheck className="w-4 h-4" />
                      ) : item.type === 'transaction' || item.type === 'invoice' ? (
                        <CreditCard className="w-4 h-4" />
                      ) : (
                        <Network className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold text-xs transition-colors ${
                            isSelected ? 'text-primary' : 'text-foreground group-hover:text-primary'
                          }`}
                        >
                          {item.title}
                        </span>
                        {item.badge && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-muted border border-border text-muted-foreground capitalize">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground block">
                        {item.subtitle}
                      </span>
                    </div>
                  </div>

                  <ArrowRight
                    className={`w-3.5 h-3.5 transition-all ${
                      isSelected
                        ? 'text-primary translate-x-1'
                        : 'text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5'
                    }`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground/80 px-1">
          <span>Navigate with &uarr;&darr; or click</span>
          <button
            type="button"
            onClick={onClose}
            className="hover:text-foreground hover:underline transition-colors cursor-pointer flex items-center gap-1"
          >
            <span>Click outside or press</span>
            <kbd className="px-1 py-0.5 rounded border border-border bg-muted font-mono text-[10px]">
              ESC
            </kbd>
            <span>to close</span>
          </button>
        </div>
      </div>
    </div>
  );
}
