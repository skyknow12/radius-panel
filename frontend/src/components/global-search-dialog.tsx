'use client';

import React from 'react';
import { Search, User, Server, Layers, Box, Network, ArrowRight } from 'lucide-react';
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
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const json = await res.json();
          setResults(json.data || []);
        }
      } catch {} finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

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
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-4 shadow-2xl animate-in zoom-in-95 duration-150 space-y-3">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/50 border border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search username, subscriber name, CID, IP, NAS, session ID..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
          {loading && <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />}
          <kbd className="hidden sm:inline-block text-[10px] bg-card px-1.5 py-0.5 rounded border border-border text-muted-foreground font-mono">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto space-y-1">
          {query.length >= 2 && results.length === 0 && !loading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No matching records found for &quot;{query}&quot;.
            </div>
          ) : (
            results.map((item, idx) => (
              <div
                key={idx}
                onClick={() => handleSelect(item)}
                className="p-3 rounded-xl hover:bg-muted/60 transition-colors cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                    {item.type === 'subscriber' ? (
                      <User className="w-4 h-4" />
                    ) : item.type === 'session' ? (
                      <Layers className="w-4 h-4 text-indigo-400" />
                    ) : item.type === 'nas' ? (
                      <Server className="w-4 h-4 text-cyan-400" />
                    ) : item.type === 'package' ? (
                      <Box className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Network className="w-4 h-4 text-blue-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">
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

                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
            ))
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="pt-2 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground/80 px-1">
          <span>Navigate with arrow keys or click</span>
          <span>Press ESC to close</span>
        </div>
      </div>
    </div>
  );
}
