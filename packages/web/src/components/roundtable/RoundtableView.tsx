'use client';

import { useEffect, useState } from 'react';
import type { ValidatorResult } from '@hermes/shared';
import { useRoundtable } from '@/hooks/useRoundtable';
import { useSocket } from '@/hooks/useSocket';
import { TopicInput } from './TopicInput';
import { SpeechCard } from './SpeechCard';
import { ConsensusCard } from './ConsensusCard';

export function RoundtableView() {
  const { speeches, consensus, isRunning, error, start } = useRoundtable();
  const { on, off } = useSocket();
  const [validator, setValidator] = useState<ValidatorResult | null>(null);
  useEffect(() => { const result = (event: ValidatorResult) => setValidator(event); on('validator:result', result); return () => off('validator:result', result); }, [on, off]);

  return (
    <section className="min-h-full p-4 sm:p-6" style={{ background: 'var(--bg-primary)' }}>
      <div className="mx-auto max-w-4xl space-y-5">
        <header>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Multi-agent deliberation</p>
          <h1 className="mt-1 text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>AI Roundtable</h1>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--text-secondary)' }}>Bring multiple agent perspectives together, then validate the final answer.</p>
        </header>

        {error && (
          <div role="alert" className="rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--error)', background: 'var(--bg-card)', color: 'var(--error)' }}>
            圆桌执行失败：{error}
          </div>
        )}

        {(!speeches.length && !consensus) || isRunning ? <TopicInput isRunning={isRunning} onStart={(config) => { setValidator(null); start(config); }} /> : null}

        {speeches.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Discussion timeline</h2>
              {isRunning && <span className="text-xs" style={{ color: 'var(--accent-info)' }}>Round {speeches[speeches.length - 1]?.round ?? 1} in progress</span>}
            </div>
            {speeches.map((speech, index) => <SpeechCard key={`${speech.round}-${speech.agent}-${index}`} speech={speech} />)}
          </div>
        )}

        {consensus && <ConsensusCard consensus={consensus} validator={validator} />}
      </div>
    </section>
  );
}
