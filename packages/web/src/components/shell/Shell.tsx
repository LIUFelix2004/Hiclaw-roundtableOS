'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useSocket } from '@/hooks/useSocket';
import { Sidebar, type ViewMode } from './Sidebar';

type ShellContextValue = { currentView: ViewMode; onViewChange: (view: ViewMode) => void };
const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell() {
  const context = useContext(ShellContext);
  if (!context) throw new Error('useShell must be used inside Shell');
  return context;
}

export function Shell({ children }: { children: ReactNode }) {
  const [currentView, onViewChange] = useState<ViewMode>('chat');
  const { isConnected } = useSocket();
  return <ShellContext.Provider value={{ currentView, onViewChange }}><TooltipProvider delayDuration={200}><div className="flex h-dvh overflow-hidden bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50"><Sidebar currentView={currentView} onViewChange={onViewChange} isConnected={isConnected} /><main className="min-w-0 flex-1 overflow-auto">{children}</main></div></TooltipProvider></ShellContext.Provider>;
}
