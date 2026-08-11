'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, Clock3, Coins, Copy, FileDiff, X } from 'lucide-react';
import type { TraceSpan } from '@hermes/shared';
import type { SnapshotView } from '@/lib/events';

const phaseLabels = ['START', 'CONTEXT_BUILD', 'MODEL_SELECTED', 'LLM_CALL', 'OUTPUT_VALIDATE', 'SUCCESS', 'FAIL'];

function duration(span: TraceSpan) {
  if (!span.endTime) return 'running';
  return `${Math.max(0, span.endTime - span.startTime)} ms`;
}

function snapshotText(snapshot?: SnapshotView) {
  return snapshot ? JSON.stringify(snapshot.data, null, 2) : '';
}

export function TracePanel({ taskId, spans, snapshots, onClose }: { taskId: string; spans: TraceSpan[]; snapshots: SnapshotView[]; onClose: () => void }) {
  const [leftSnapshot, setLeftSnapshot] = useState('');
  const [rightSnapshot, setRightSnapshot] = useState('');
  const ordered = useMemo(() => [...spans].sort((a, b) => a.startTime - b.startTime), [spans]);
  const left = snapshots.find((snapshot) => snapshot.id === leftSnapshot);
  const right = snapshots.find((snapshot) => snapshot.id === rightSnapshot);

  return (
    <aside className="absolute inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l shadow-xl" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }} aria-label="Agent trace panel">
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border-color)' }}>
        <div>
          <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Execution trace</p>
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{taskId}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close trace panel" className="rounded-md p-1.5 hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="relative space-y-4 pl-5 before:absolute before:bottom-2 before:left-2 before:top-2 before:w-px" style={{ '--tw-before-bg': 'var(--border-light)' } as React.CSSProperties}>
          {ordered.length ? ordered.map((span) => (
            <div key={span.id} className="relative">
              <span className="absolute -left-[1.23rem] top-1 flex h-4 w-4 items-center justify-center rounded-full" style={{ background: 'var(--bg-card)', color: span.status === 'success' ? 'var(--success)' : span.status === 'failed' ? 'var(--error)' : 'var(--accent-info)' }}>
                {span.status === 'success' ? <CheckCircle2 className="h-4 w-4" /> : span.status === 'failed' ? <CircleAlert className="h-4 w-4" /> : <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--accent-info)' }} />}
              </span>
              <div className="rounded-md border p-3" style={{ borderColor: 'var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{span.name}</span>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{duration(span)}</span>
                </div>
                <div className="mt-2 flex gap-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />{new Date(span.startTime).toLocaleTimeString()}</span>
                  {span.tokens !== undefined && <span className="flex items-center gap-1"><Copy className="h-3 w-3" />{span.tokens} tokens</span>}
                  {span.cost !== undefined && <span className="flex items-center gap-1"><Coins className="h-3 w-3" />${span.cost.toFixed(4)}</span>}
                </div>
              </div>
            </div>
          )) : (
            <div className="rounded-md border border-dashed p-4 text-sm" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
              Trace spans will appear as the agent executes.
            </div>
          )}
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center gap-2">
            <FileDiff className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Snapshot comparison</h3>
          </div>
          {snapshots.length ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select value={leftSnapshot} onChange={(e) => setLeftSnapshot(e.target.value)} className="h-9 rounded-md border px-2 text-xs" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                  <option value="">Before snapshot</option>
                  {snapshots.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <select value={rightSnapshot} onChange={(e) => setRightSnapshot(e.target.value)} className="h-9 rounded-md border px-2 text-xs" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                  <option value="">After snapshot</option>
                  {snapshots.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <pre className="max-h-48 overflow-auto rounded-md p-2 text-[10px]" style={{ background: 'var(--code-bg)', color: 'var(--text-secondary)' }}>{snapshotText(left) || 'Select a snapshot'}</pre>
                <pre className="max-h-48 overflow-auto rounded-md p-2 text-[10px]" style={{ background: 'var(--code-bg)', color: 'var(--text-secondary)' }}>{snapshotText(right) || 'Select a snapshot'}</pre>
              </div>
            </div>
          ) : <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No snapshots available for this task.</p>}
        </div>

        <div className="mt-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Expected phases</h3>
          <div className="flex flex-wrap gap-1">
            {phaseLabels.map((phase) => (
              <span key={phase} className="rounded-full border px-2 py-1 text-[10px]" style={{
                borderColor: ordered.some((s) => s.name === phase) ? 'var(--accent-primary)' : 'var(--border-color)',
                color: ordered.some((s) => s.name === phase) ? 'var(--text-primary)' : 'var(--text-muted)',
                background: ordered.some((s) => s.name === phase) ? 'var(--bg-secondary)' : 'transparent',
              }}>{phase}</span>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
