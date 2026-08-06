'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, Clock3, Coins, Copy, FileDiff, X } from 'lucide-react';
import type { AgentSnapshot, TraceSpan } from '@hermes/shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

const phaseLabels = ['START', 'CONTEXT_BUILD', 'MODEL_SELECTED', 'LLM_CALL', 'OUTPUT_VALIDATE', 'SUCCESS', 'FAIL'];

function duration(span: TraceSpan) {
  if (!span.endTime) return 'running';
  return `${Math.max(0, span.endTime - span.startTime)} ms`;
}

function snapshotText(snapshot?: AgentSnapshot) {
  return snapshot ? JSON.stringify(snapshot.data, null, 2) : '';
}

export function TracePanel({ taskId, spans, snapshots, onClose }: { taskId: string; spans: TraceSpan[]; snapshots: AgentSnapshot[]; onClose: () => void }) {
  const [leftSnapshot, setLeftSnapshot] = useState('');
  const [rightSnapshot, setRightSnapshot] = useState('');
  const ordered = useMemo(() => [...spans].sort((a, b) => a.startTime - b.startTime), [spans]);
  const left = snapshots.find((snapshot) => snapshot.id === leftSnapshot);
  const right = snapshots.find((snapshot) => snapshot.id === rightSnapshot);
  return <aside className="absolute inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950" aria-label="Agent trace panel"><div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800"><div><p className="text-xs uppercase tracking-wide text-zinc-500">Execution trace</p><h2 className="font-semibold">{taskId}</h2></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Close trace panel"><X className="h-4 w-4" /></Button></div><div className="flex-1 overflow-y-auto p-4"><div className="relative space-y-4 pl-5 before:absolute before:bottom-2 before:left-2 before:top-2 before:w-px before:bg-zinc-200 dark:before:bg-zinc-800">{ordered.length ? ordered.map((span) => <div key={span.id} className="relative"><span className={cn('absolute -left-[1.23rem] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-4 ring-white dark:bg-zinc-950 dark:ring-zinc-950', span.status === 'success' ? 'text-emerald-500' : span.status === 'failed' ? 'text-red-500' : 'text-blue-500')}>{span.status === 'success' ? <CheckCircle2 className="h-4 w-4" /> : span.status === 'failed' ? <CircleAlert className="h-4 w-4" /> : <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />}</span><div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"><div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{span.name}</span><span className="text-[11px] text-zinc-500">{duration(span)}</span></div><div className="mt-2 flex gap-3 text-[11px] text-zinc-500"><span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />{new Date(span.startTime).toLocaleTimeString()}</span>{span.tokens !== undefined && <span className="flex items-center gap-1"><Copy className="h-3 w-3" />{span.tokens} tokens</span>}{span.cost !== undefined && <span className="flex items-center gap-1"><Coins className="h-3 w-3" />${span.cost.toFixed(4)}</span>}</div></div></div>) : <div className="rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700">Trace spans will appear as the agent executes.</div>}</div><div className="mt-6"><div className="mb-2 flex items-center gap-2"><FileDiff className="h-4 w-4 text-violet-500" /><h3 className="text-sm font-semibold">Snapshot comparison</h3></div>{snapshots.length ? <div className="space-y-2"><div className="grid grid-cols-2 gap-2"><select value={leftSnapshot} onChange={(event) => setLeftSnapshot(event.target.value)} className="h-9 rounded-md border border-zinc-200 bg-transparent px-2 text-xs dark:border-zinc-700"><option value="">Before snapshot</option>{snapshots.map((snapshot) => <option key={snapshot.id} value={snapshot.id}>{snapshot.label}</option>)}</select><select value={rightSnapshot} onChange={(event) => setRightSnapshot(event.target.value)} className="h-9 rounded-md border border-zinc-200 bg-transparent px-2 text-xs dark:border-zinc-700"><option value="">After snapshot</option>{snapshots.map((snapshot) => <option key={snapshot.id} value={snapshot.id}>{snapshot.label}</option>)}</select></div><div className="grid gap-2 sm:grid-cols-2"><pre className="max-h-48 overflow-auto rounded-md bg-zinc-100 p-2 text-[10px] dark:bg-zinc-900">{snapshotText(left) || 'Select a snapshot'}</pre><pre className="max-h-48 overflow-auto rounded-md bg-zinc-100 p-2 text-[10px] dark:bg-zinc-900">{snapshotText(right) || 'Select a snapshot'}</pre></div></div> : <p className="text-xs text-zinc-500">No snapshots available for this task.</p>}</div><div className="mt-6"><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Expected phases</h3><div className="flex flex-wrap gap-1">{phaseLabels.map((phase) => <span key={phase} className={cn('rounded-full border px-2 py-1 text-[10px]', ordered.some((span) => span.name === phase) ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300' : 'border-zinc-200 text-zinc-400 dark:border-zinc-800')}>{phase}</span>)}</div></div></div></aside>;
}
