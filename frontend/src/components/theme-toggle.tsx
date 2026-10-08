'use client';

import * as React from 'react';
import { useAppTheme, THEME_OPTIONS } from '@/context/app-theme-context';
import { Sun, Palette, Check } from 'lucide-react';

interface ThemeToggleProps {
  onOpenAppearanceSettings?: () => void;
}

export function ThemeToggle({ onOpenAppearanceSettings }: ThemeToggleProps) {
  const { theme, setTheme } = useAppTheme();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown on outside click
  React.useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = () => setMenuOpen(false);
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, [menuOpen]);

  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-lg border border-border bg-card/50 flex items-center justify-center" />
    );
  }

  const isLight = theme !== 'dark-pro';
  const currentOption = THEME_OPTIONS.find((t) => t.id === theme) || THEME_OPTIONS[0];

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setMenuOpen((prev) => !prev)}
        className="h-9 px-2.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground flex items-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs font-semibold shadow-sm"
        title="Theme Studio & Switcher"
        aria-label="Theme Selector"
      >
        {isLight ? (
          <Sun className="w-3.5 h-3.5 text-amber-500 animate-in fade-in zoom-in duration-200" />
        ) : (
          <Palette className="w-3.5 h-3.5 text-primary animate-in fade-in zoom-in duration-200" />
        )}
        <span className="hidden sm:inline-block font-mono text-[11px] font-bold">
          {currentOption.name}
        </span>
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-card p-2 shadow-2xl z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-2.5 py-1.5 border-b border-border/80 flex items-center justify-between">
            <span className="font-bold text-foreground text-xs flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-primary" />
              Theme Switcher
            </span>
            <span className="text-[10px] text-muted-foreground uppercase font-mono">5 Themes</span>
          </div>

          <div className="py-1 space-y-0.5">
            {THEME_OPTIONS.map((t) => {
              const active = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setTheme(t.id);
                    setMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors text-left ${
                    active
                      ? 'bg-primary/15 text-primary font-bold'
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full border border-white/20 shadow-sm flex-shrink-0"
                      style={{ backgroundColor: t.primaryColor }}
                    />
                    <div className="flex flex-col">
                      <span className="text-xs leading-none">{t.name}</span>
                      <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                        {t.tagline}
                      </span>
                    </div>
                  </div>
                  {active && <Check className="w-3.5 h-3.5 text-primary stroke-[3]" />}
                </button>
              );
            })}
          </div>

          {onOpenAppearanceSettings && (
            <div className="pt-1.5 border-t border-border/80">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onOpenAppearanceSettings();
                }}
                className="w-full text-center py-1.5 text-xs font-semibold text-primary hover:underline rounded-md"
              >
                Appearance & Logo Studio →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
