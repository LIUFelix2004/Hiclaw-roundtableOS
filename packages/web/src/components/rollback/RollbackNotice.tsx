'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, CircleAlert, RotateCcw, ShieldAlert } from 'lucide-react';
import type { RollbackCompleteEvent, RollbackEvent, RollbackStrategy } from '@hermes/shared';

const labels: Record<RollbackStrategy, string> = { snapshot_restore: 'Snapshot restore', model_switch: 'Model switch', rerun: 'Rerun task', human_escalation: 'Human escalation' };

export function RollbackNotice({ started, completed }: { started?: RollbackEvent | null; completed?: RollbackCompleteEvent | null }) {
  if (!started && !completed) return null;
  const isComplete = Boolean(completed);
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 border-b px-4 py-3 text-sm"
      style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)', color: isComplete ? 'var(--success)' : 'var(--warning)' }}
      role="status"
    >
      <span className="mt-0.5 shrink-0">{isComplete ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4 animate-pulse" />}</span>
      <div className="min-w-0" style={{ color: 'var(--text-primary)' }}>
        <p className="font-medium">
          {isComplete ? 'Rollback complete' : 'Rollback in progress'}{' '}
          <span className="font-normal" style={{ color: 'var(--text-secondary)' }}>for task {completed?.taskId ?? started?.taskId}</span>
        </p>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          {isComplete ? `${labels[completed!.strategy]}: ${completed!.result}` : `${started!.errorType.replace('_', ' ')} - switching from ${started!.fromModel} to ${started!.toModel}`}
        </p>
      </div>
      {!isComplete && <RotateCcw className="ml-auto h-4 w-4 shrink-0 animate-spin" style={{ color: 'var(--warning)' }} />}
    </motion.div>
  );
}

export function RollbackStrategyIcon({ strategy }: { strategy: RollbackStrategy }) {
  return strategy === 'human_escalation' ? <ShieldAlert className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />;
}
