'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Bot, BrainCircuit, ChevronLeft, LayoutDashboard, MessageSquare, Network, PanelLeft, Settings } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ThemeToggle } from './ThemeToggle';

export type ViewMode = 'chat' | 'canvas' | 'roundtable' | 'dashboard';
type SidebarProps = { currentView: ViewMode; onViewChange: (view: ViewMode) => void; isConnected: boolean };

const navigation: { key: ViewMode; label: string; icon: typeof MessageSquare }[] = [
  { key: 'chat', label: 'Dialogue', icon: MessageSquare },
  { key: 'canvas', label: 'DAG Canvas', icon: Network },
  { key: 'roundtable', label: 'AI Roundtable', icon: BrainCircuit },
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

export function Sidebar({ currentView, onViewChange, isConnected }: SidebarProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  React.useEffect(() => {
    const sync = () => setCollapsed(window.innerWidth < 768);
    sync(); window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex h-full shrink-0 flex-col border-r"
      style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-color)' }}
    >
      {/* Header */}
      <div className={cn('flex items-center border-b', collapsed ? 'justify-center px-2' : 'justify-between px-4')} style={{ height: 'var(--header-height)', borderColor: 'var(--border-color)' }}>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex min-w-0 items-center gap-3 rounded-md text-left outline-none"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={{ background: 'var(--accent-primary)', color: 'var(--text-on-accent)' }}>
            <Bot className="h-4 w-4" />
          </span>
          {!collapsed && <span className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Hermes AgentOS</span>}
        </button>
        {!collapsed && (
          <button type="button" onClick={() => setCollapsed(true)} aria-label="Collapse sidebar" className="rounded-md p-1.5 hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav aria-label="Main navigation" className="flex-1 space-y-0.5 p-2">
        {navigation.map(({ key, label, icon: Icon }) => {
          const active = currentView === key;
          const item = (
            <button
              type="button"
              onClick={() => onViewChange(key)}
              aria-current={active ? 'page' : undefined}
              className={cn('flex h-9 w-full items-center gap-3 rounded-md px-3 text-[13px] font-medium', collapsed && 'justify-center px-0')}
              style={{
                background: active ? 'var(--bg-card-hover)' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderLeft: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className={cn('truncate', collapsed && 'sr-only')}>{label}</span>
            </button>
          );
          return collapsed
            ? <Tooltip key={key}><TooltipTrigger asChild>{item}</TooltipTrigger><TooltipContent side="right">{label}</TooltipContent></Tooltip>
            : <div key={key}>{item}</div>;
        })}
      </nav>

      {/* Footer */}
      <div className="space-y-1.5 border-t p-2" style={{ borderColor: 'var(--border-color)' }}>
        {/* Connection status */}
        <div className={cn('flex items-center gap-2 rounded-md px-3 py-1.5 text-xs', collapsed && 'justify-center px-0')} title={isConnected ? 'Socket connected' : 'Socket disconnected'}>
          <span className={cn('h-2 w-2 shrink-0 rounded-full')} style={{ background: isConnected ? 'var(--success)' : 'var(--error)' }} aria-hidden="true" />
          <span className={cn('truncate', collapsed && 'sr-only')} style={{ color: 'var(--text-muted)' }}>{isConnected ? 'Server connected' : 'Server disconnected'}</span>
        </div>
        {/* Theme toggle */}
        <div className={cn('flex', collapsed && 'justify-center')}>
          <ThemeToggle collapsed={collapsed} />
        </div>
        {/* Expand button when collapsed */}
        {collapsed && (
          <button type="button" onClick={() => setCollapsed(false)} aria-label="Expand sidebar" className="flex w-full items-center justify-center rounded-md p-2 hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
            <PanelLeft className="h-4 w-4" />
          </button>
        )}
      </div>
    </motion.aside>
  );
}
