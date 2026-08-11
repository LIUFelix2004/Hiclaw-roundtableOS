'use client';

import { Activity, CheckCircle2, CircleAlert, LoaderCircle } from 'lucide-react';
import type { AgentStatus } from '@hermes/shared';

function statusColor(status: string) {
  if (status === 'running') return 'var(--accent-info)';
  if (status === 'success') return 'var(--success)';
  if (status === 'failed') return 'var(--error)';
  return 'var(--accent-muted)';
}

export function AgentStatusBar({ statuses }: { statuses: AgentStatus[] }) {
  if (!statuses.length) return null;
  return (
    <div className="flex gap-2 overflow-x-auto border-b px-4 py-2" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }} aria-label="Agent status">
      {statuses.map((status) => (
        <div key={status.taskId} className="flex min-w-32 items-center gap-2 rounded-md border px-2.5 py-2" style={{ borderColor: 'var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
          <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: 'var(--bg-secondary)', color: statusColor(status.status) }}>
            {status.status === 'running' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              : status.status === 'success' ? <CheckCircle2 className="h-3.5 w-3.5" />
              : status.status === 'failed' ? <CircleAlert className="h-3.5 w-3.5" />
              : <Activity className="h-3.5 w-3.5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{status.agent}</span>
            <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>{Math.max(0, Math.min(100, status.progress))}%</span>
          </span>
          <span className="h-2 w-2 rounded-full" style={{ background: statusColor(status.status) }} />
        </div>
      ))}
    </div>
  );
}
