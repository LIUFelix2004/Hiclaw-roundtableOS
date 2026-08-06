'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RoundtableConfig, RoundtableConsensus, RoundtableSpeech } from '@hermes/shared';
import { useSocket } from './useSocket';

export function useRoundtable() {
  const { emit, on, off } = useSocket();
  const [speeches, setSpeeches] = useState<RoundtableSpeech[]>([]);
  const [consensus, setConsensus] = useState<RoundtableConsensus | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    const handleSpeech = (speech: RoundtableSpeech) => { setSpeeches((current) => [...current, speech]); setIsRunning(true); };
    const handleConsensus = (result: RoundtableConsensus) => { setConsensus(result); setIsRunning(false); };
    on('roundtable:speech', handleSpeech);
    on('roundtable:consensus', handleConsensus);
    return () => { off('roundtable:speech', handleSpeech); off('roundtable:consensus', handleConsensus); };
  }, [on, off]);

  const start = useCallback((config: RoundtableConfig) => {
    setSpeeches([]); setConsensus(null); setIsRunning(true); emit('roundtable:start', config);
  }, [emit]);

  return { speeches, consensus, isRunning, start };
}
