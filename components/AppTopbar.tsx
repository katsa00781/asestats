'use client';

import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NAV_GROUPS } from '@/components/AppSidebar';

interface AppTopbarProps {
  activeTab: string;
  userEmail: string;
  isAdmin: boolean;
  onSignOut: () => void;
}

function findBreadcrumb(activeTab: string) {
  for (const group of NAV_GROUPS) {
    const item = group.items.find(i => i.key === activeTab);
    if (item) return { groupLabel: group.label, itemLabel: item.label };
  }
  return null;
}

export function AppTopbar({ activeTab, userEmail, isAdmin, onSignOut }: AppTopbarProps) {
  const crumb = findBreadcrumb(activeTab);

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4 mb-6">
      <div className="flex min-w-0 items-center gap-2 font-display uppercase tracking-[0.14em] text-xs text-secondary">
        <span className="hidden sm:inline">ASE Statisztika Kezelő</span>
        {crumb && (
          <>
            <span className="hidden sm:inline text-muted">›</span>
            <span className="truncate">{crumb.groupLabel}</span>
            <span className="text-muted">›</span>
            <span className="truncate text-cyan">{crumb.itemLabel}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden md:flex items-center gap-2 text-xs text-secondary">
          <span className="font-mono truncate max-w-55">{userEmail}</span>
        </div>
        {isAdmin && <Badge className="badge-cyan">Admin</Badge>}
        <Button
          variant="outline"
          size="sm"
          onClick={onSignOut}
          className="flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Kijelentkezés</span>
        </Button>
      </div>
    </header>
  );
}
