'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShieldAlert } from 'lucide-react';
import type { RollbackHumanEvent } from '@hermes/shared';

export function RollbackHumanDialog({ event, onRespond }: { event: RollbackHumanEvent | null; onRespond: (action: 'approve' | 'dismiss') => void }) {
  return (
    <Dialog open={Boolean(event)} onOpenChange={(open) => { if (!open) onRespond('dismiss'); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" style={{ color: 'var(--warning)' }} /> Human intervention required
          </DialogTitle>
          <DialogDescription>Rollback paused task {event?.taskId ?? 'unknown'} for a decision.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 rounded-md p-3 text-sm" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
          <p>{event?.reason}</p>
          {event?.context && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{event.context}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => onRespond('dismiss')} className="rounded-md border px-4 py-2 text-sm" style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            Dismiss
          </button>
          <button type="button" onClick={() => onRespond('approve')} className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium" style={{ background: 'var(--accent-primary)', color: 'var(--text-on-accent)' }}>
            <ShieldAlert className="h-4 w-4" /> Approve rollback
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
