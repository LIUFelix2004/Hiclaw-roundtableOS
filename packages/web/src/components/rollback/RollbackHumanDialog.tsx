'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';
import type { RollbackHumanEvent } from '@hermes/shared';

export function RollbackHumanDialog({ event, onRespond }: { event: RollbackHumanEvent | null; onRespond: (action: 'approve' | 'dismiss') => void }) {
  return <Dialog open={Boolean(event)} onOpenChange={(open) => { if (!open) onRespond('dismiss'); }}><DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-amber-500" /> Human intervention required</DialogTitle><DialogDescription>Rollback paused task {event?.taskId ?? 'unknown'} for a decision.</DialogDescription></DialogHeader><div className="space-y-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100"><p>{event?.reason}</p>{event?.context && <p className="text-xs opacity-80">{event.context}</p>}</div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => onRespond('dismiss')}>Dismiss</Button><Button onClick={() => onRespond('approve')}><ShieldAlert className="h-4 w-4" /> Approve rollback</Button></div></DialogContent></Dialog>;
}
