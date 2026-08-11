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
  return (
    <ShellContext.Provider value={{ currentView, onViewChange }}>
      <TooltipProvider delayDuration={200}>
        <div className="flex h-dvh overflow-hidden" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
          <Sidebar currentView={currentView} onViewChange={onViewChange} isConnected={isConnected} />
          <main className="min-w-0 flex-1 overflow-auto" style={{ background: 'var(--bg-primary)' }}>
            {children}
          </main>
        </div>
      </TooltipProvider>
    </ShellContext.Provider>
  );
}
