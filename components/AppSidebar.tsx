'use client';

import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  Sparkles,
  Target,
  Trophy,
  Calendar,
  ClipboardList,
  RefreshCw,
  UserCog,
  Upload,
  Trash2,
  DatabaseZap,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavTone = 'ai' | 'negative';

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  tone?: NavTone;
}

export interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
}

export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'analitika',
    label: 'Analitika',
    items: [
      { key: 'overview', label: 'Áttekintés', icon: LayoutDashboard },
      { key: 'players', label: 'Játékosok', icon: Users },
      { key: 'comparison', label: 'Elemzések', icon: Sparkles, tone: 'ai' },
      { key: 'situational', label: 'Szituációk', icon: Target },
    ],
  },
  {
    key: 'csapat',
    label: 'Csapat',
    items: [
      { key: 'standings', label: 'Tabella', icon: Trophy },
      { key: 'games', label: 'Mérkőzések', icon: Calendar },
      { key: 'gamelog', label: 'Meccs Log', icon: ClipboardList },
      { key: 'updates', label: 'Frissítések', icon: RefreshCw },
    ],
  },
  {
    key: 'admin',
    label: 'Admin',
    adminOnly: true,
    items: [
      { key: 'manage', label: 'Kezelés', icon: UserCog },
      { key: 'playersimport', label: 'Játékos Import', icon: Upload },
      { key: 'delete', label: 'Törlés', icon: Trash2, tone: 'negative' },
      { key: 'import', label: 'Import', icon: DatabaseZap },
    ],
  },
];

const COLLAPSE_STORAGE_KEY = 'ase.sidebar.collapsed';

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isAdmin: boolean;
  userEmail: string;
  onCollapsedChange?: (collapsed: boolean) => void;
  navMeta?: Record<string, number>;
}

export function AppSidebar({ activeTab, onTabChange, isAdmin, userEmail, onCollapsedChange, navMeta }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1');
  }, []);

  useEffect(() => {
    onCollapsedChange?.(collapsed);
  }, [collapsed, onCollapsedChange]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        setCollapsed(prev => {
          const next = !prev;
          window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0');
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  };

  const visibleGroups = NAV_GROUPS.filter(group => !group.adminOnly || isAdmin);
  const avatarLetter = userEmail.charAt(0).toUpperCase() || '?';

  return (
    <aside className="sidebar" data-collapsed={collapsed}>
      <div className="sb-header">
        <div className="sb-logo" aria-hidden="true">
          <Trophy className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </div>
        <div className="sb-brand">
          <span className="sb-wordmark">ASE</span>
          <span className="sb-sub">Statisztika</span>
        </div>
        <button
          type="button"
          className="sb-toggle"
          onClick={toggleCollapsed}
          aria-label="Navigáció kibontása / összecsukása"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      <nav className="sb-nav" aria-label="Fő navigáció">
        {visibleGroups.map(group => (
          <div key={group.key} className="sb-group">
            <div className="sb-group-label">{group.label}</div>
            {group.items.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              const meta = navMeta?.[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  className={cn('nav-item', isActive && 'active')}
                  data-tone={item.tone}
                  onClick={() => onTabChange(item.key)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="nav-item-icon">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.6} />
                  </span>
                  <span className="nav-item-label">{item.label}</span>
                  {meta !== undefined && <span className="nav-item-meta">{meta}</span>}
                  <span className="nav-item-tip">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sb-footer">
        <div className="sb-avatar" aria-hidden="true">{avatarLetter}</div>
        <div className="sb-user">
          <span className="sb-user-email">{userEmail}</span>
          <span className="sb-user-role">{isAdmin ? 'Admin' : 'Felhasználó'}</span>
        </div>
      </div>
    </aside>
  );
}
