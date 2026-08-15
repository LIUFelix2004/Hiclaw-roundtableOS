'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import type { ValidatorResult } from '@hermes/shared';

const DIMENSIONS: { key: keyof ValidatorResult['scores']; label: string }[] = [
  { key: 'accuracy', label: '准确性' },
  { key: 'completeness', label: '完整性' },
  { key: 'safety', label: '安全性' },
  { key: 'format', label: '格式' },
];

export function ValidatorCard({ result }: { result: ValidatorResult }) {
  const passColor = result.pass ? 'var(--success)' : 'var(--error)';

  return (
    <div
      className="rounded-lg border p-4 text-sm"
      style={{ borderColor: passColor, background: 'var(--bg-card)' }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {result.pass ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: 'var(--success)' }} />
          ) : (
            <XCircle className="h-4 w-4 shrink-0" style={{ color: 'var(--error)' }} />
          )}
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
            校验结果{result.agent ? ` · ${result.agent}` : ''}
          </span>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ background: passColor, color: 'var(--text-on-accent)' }}
        >
          {result.pass ? 'PASS' : 'FAIL'}
        </span>
      </div>

      <div className="space-y-2">
        {DIMENSIONS.map(({ key, label }) => {
          const pct = Math.round(result.scores[key] * 100);
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs" style={{ color: 'var(--text-secondary)' }}>
                {label}
              </span>
              <div
                className="h-2 flex-1 overflow-hidden rounded-full"
                style={{ background: 'var(--bg-secondary)' }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: passColor }}
                />
              </div>
              <span
                className="w-10 shrink-0 text-right text-xs tabular-nums"
                style={{ color: 'var(--text-muted)' }}
              >
                {pct}%
              </span>
            </div>
          );
        })}
      </div>

      {!result.pass && result.failCodes && result.failCodes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {result.failCodes.map((code) => (
            <span
              key={code}
              className="rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ background: 'var(--bg-secondary)', color: 'var(--error)' }}
            >
              {code}
            </span>
          ))}
        </div>
      )}

      {!result.pass && result.issues && result.issues.length > 0 && (
        <ul
          className="mt-3 list-disc space-y-1 pl-4 text-xs"
          style={{ color: 'var(--text-secondary)' }}
        >
          {result.issues.map((issue, idx) => (
            <li key={idx}>{issue}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
