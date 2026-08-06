'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Bot, BrainCircuit, ChevronLeft, LayoutDashboard, MessageSquare, Network, PanelLeft } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
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
    <motion.aside initial={false} animate={{ width: collapsed ? 72 : 256 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="flex h-full shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className={cn('flex h-16 items-center border-b border-zinc-200 dark:border-zinc-800', collapsed ? 'justify-center px-2' : 'justify-between px-4')}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" onClick={() => setCollapsed((value) => !value)} className="flex min-w-0 items-center gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white"><Bot className="h-4 w-4" /></span>
              {!collapsed && <span className="truncate text-sm font-semibold tracking-tight">Hermes AgentOS</span>}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</TooltipContent>
        </Tooltip>
        {!collapsed && <Button variant="ghost" size="icon" onClick={() => setCollapsed(true)} aria-label="Collapse sidebar"><ChevronLeft className="h-4 w-4" /></Button>}
      </div>

      <nav aria-label="Main navigation" className="flex-1 space-y-1 p-3">
        {navigation.map(({ key, label, icon: Icon }) => {
          const active = currentView === key;
          const item = <button type="button" onClick={() => onViewChange(key)} aria-current={active ? 'page' : undefined} className={cn('flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500', collapsed && 'justify-center px-0', active ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900')}><Icon className="h-4 w-4 shrink-0" /><span className={cn('truncate', collapsed && 'sr-only')}>{label}</span></button>;
          return collapsed ? <Tooltip key={key}><TooltipTrigger asChild>{item}</TooltipTrigger><TooltipContent side="right">{label}</TooltipContent></Tooltip> : <div key={key}>{item}</div>;
        })}
      </nav>

      <div className="space-y-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
        <div className={cn('flex items-center gap-2 rounded-md px-3 py-2 text-xs', collapsed && 'justify-center px-0')} title={isConnected ? 'Socket connected' : 'Socket disconnected'}>
          <span className={cn('h-2 w-2 shrink-0 rounded-full', isConnected ? 'bg-emerald-500' : 'bg-red-500')} aria-hidden="true" />
          <span className={cn('truncate text-zinc-500 dark:text-zinc-400', collapsed && 'sr-only')}>{isConnected ? 'Server connected' : 'Server disconnected'}</span>
        </div>
        <div className={cn('flex', collapsed && 'justify-center')}><ThemeToggle collapsed={collapsed} /></div>
        {collapsed && <Button variant="ghost" size="icon" onClick={() => setCollapsed(false)} aria-label="Expand sidebar" className="w-full"><PanelLeft className="h-4 w-4" /></Button>}
      </div>
    </motion.aside>
  );
}
