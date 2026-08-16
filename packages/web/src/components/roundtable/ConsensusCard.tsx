'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import type { RoundtableConsensus, ValidatorResult } from '@hermes/shared';

export function ConsensusCard({ consensus, validator }: { consensus: RoundtableConsensus; validator?: ValidatorResult | null }) {
  const scores = validator?.scores;
  // 防御性默认值：live 链路 / 桥接事件的载荷若字段缺失，降级为空数组而不是渲染崩溃
  const agreements = consensus.agreements ?? [];
  const risks = consensus.risks ?? consensus.disagreements ?? [];
  const tasks = consensus.tasks ?? consensus.executionTasks ?? [];
  const finalAnswer = consensus.finalAnswer ?? consensus.finalSolution ?? '';
  return (
    <div className="space-y-5 rounded-lg border p-5" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)' }}>
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--success)' }} />
        <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Consensus reached</h2>
        <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>{consensus.rounds} rounds</span>
      </div>

      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{finalAnswer}</ReactMarkdown>
      </div>

      {tasks.length ? (
        <div className="overflow-x-auto">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Execution tasks</h3>
          <table className="w-full min-w-[42rem] text-left text-xs">
            <thead style={{ color: 'var(--text-muted)' }}>
              <tr><th className="pb-2 pr-3">Agent</th><th className="pb-2 pr-3">Target</th><th className="pb-2 pr-3">Input</th><th className="pb-2">Expected output</th></tr>
            </thead>
            <tbody>
              {tasks.map((task, index) => (
                <tr key={`${task.agent}-${index}`} className="border-t" style={{ borderColor: 'var(--border-light)' }}>
                  <td className="py-2 pr-3 font-medium capitalize">{task.agent}</td>
                  <td className="py-2 pr-3">{task.target ?? task.objective}</td>
                  <td className="py-2 pr-3">{task.input}</td>
                  <td className="py-2">{task.expectedOutput}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Agreements</h3>
          <ul className="space-y-1 text-sm">
            {agreements.map((item) => (
              <li key={item} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--success)' }} />{item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Disagreements / risks</h3>
          <ul className="space-y-1 text-sm">
            {risks.map((item) => (
              <li key={item} className="flex gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--warning)' }} />{item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {scores && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Validator</h3>
            <span className="text-xs font-semibold" style={{ color: validator?.pass ? 'var(--success)' : 'var(--error)' }}>{validator?.pass ? 'Pass' : 'Review required'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(scores).map(([label, value]) => (
              <div key={label}>
                <div className="mb-1 flex justify-between text-[11px] capitalize" style={{ color: 'var(--text-muted)' }}>
                  <span>{label}</span><span>{value}/100</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: 'var(--bg-secondary)' }}>
                  <div className="h-full rounded-full" style={{ width: `${value}%`, background: 'var(--accent-primary)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
