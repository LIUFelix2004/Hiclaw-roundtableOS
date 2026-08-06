'use client';

import { Activity, CheckCircle2, CircleAlert, LoaderCircle } from 'lucide-react';
import type { AgentStatus } from '@hermes/shared';
import { cn } from '@/lib/cn';

export function AgentStatusBar({ statuses }: { statuses: AgentStatus[] }) {
  if (!statuses.length) return null;
  return <div className="flex gap-2 overflow-x-auto border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-950" aria-label="Agent status">
    {statuses.map((status) => <div key={status.taskId} className="flex min-w-32 items-center gap-2 rounded-md border border-zinc-200 px-2.5 py-2 dark:border-zinc-800"><span className={cn('flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800', status.status === 'running' && 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300', status.status === 'success' && 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300', status.status === 'failed' && 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-300')}>{status.status === 'running' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : status.status === 'success' ? <CheckCircle2 className="h-3.5 w-3.5" /> : status.status === 'failed' ? <CircleAlert className="h-3.5 w-3.5" /> : <Activity className="h-3.5 w-3.5" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{status.agent}</span><span className="block text-[11px] text-zinc-500">{Math.max(0, Math.min(100, status.progress))}%</span></span><span className={cn('h-2 w-2 rounded-full bg-zinc-400', status.status === 'running' && 'bg-blue-500 animate-pulse', status.status === 'success' && 'bg-emerald-500', status.status === 'failed' && 'bg-red-500')} /></div>)}
  </div>;
}
