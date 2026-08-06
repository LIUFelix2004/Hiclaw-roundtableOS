'use client';

import { useEffect, useState } from 'react';
import type { ValidatorResult } from '@hermes/shared';
import { useRoundtable } from '@/hooks/useRoundtable';
import { useSocket } from '@/hooks/useSocket';
import { TopicInput } from './TopicInput';
import { SpeechCard } from './SpeechCard';
import { ConsensusCard } from './ConsensusCard';

export function RoundtableView() {
  const { speeches, consensus, isRunning, start } = useRoundtable();
  const { on, off } = useSocket();
  const [validator, setValidator] = useState<ValidatorResult | null>(null);
  useEffect(() => { const result = (event: ValidatorResult) => setValidator(event); on('validator:result', result); return () => off('validator:result', result); }, [on, off]);
  return <section className="min-h-full bg-zinc-50 p-4 dark:bg-zinc-950 sm:p-6"><div className="mx-auto max-w-5xl space-y-5"><header><p className="text-xs font-medium uppercase tracking-wider text-violet-600">Multi-agent deliberation</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">AI Roundtable</h1><p className="mt-1 text-sm text-zinc-500">Bring multiple agent perspectives together, then validate the final answer.</p></header>{(!speeches.length && !consensus) || isRunning ? <TopicInput isRunning={isRunning} onStart={(config) => { setValidator(null); start(config); }} /> : null}{speeches.length > 0 && <div className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Discussion timeline</h2>{isRunning && <span className="text-xs text-blue-600">Round {speeches[speeches.length - 1]?.round ?? 1} in progress</span>}</div>{speeches.map((speech, index) => <SpeechCard key={`${speech.round}-${speech.agent}-${index}`} speech={speech} />)}</div>}{consensus && <ConsensusCard consensus={consensus} validator={validator} />}</div></section>;
}
