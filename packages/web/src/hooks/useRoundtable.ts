'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RoundtableConfig, RoundtableConsensus, RoundtableSpeech } from '@hermes/shared';
import { useSocket } from './useSocket';

export function useRoundtable() {
  const { emit, on, off } = useSocket();
  const [speeches, setSpeeches] = useState<RoundtableSpeech[]>([]);
  const [consensus, setConsensus] = useState<RoundtableConsensus | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleSpeech = (speech: RoundtableSpeech) => { setSpeeches((current) => [...current, speech]); setIsRunning(true); };
    const handleConsensus = (result: RoundtableConsensus) => { setConsensus(result); setIsRunning(false); };
    // bridge 在圆桌失败时会发 roundtable:error；之前前端无监听，失败后永远转圈
    const handleError = ({ message }: { message: string }) => { setError(message); setIsRunning(false); };
    on('roundtable:speech', handleSpeech);
    on('roundtable:consensus', handleConsensus);
    on('roundtable:error', handleError);
    return () => { off('roundtable:speech', handleSpeech); off('roundtable:consensus', handleConsensus); off('roundtable:error', handleError); };
  }, [on, off]);

  const start = useCallback((config: RoundtableConfig) => {
    setSpeeches([]); setConsensus(null); setError(null); setIsRunning(true); emit('roundtable:start', config);
  }, [emit]);

  return { speeches, consensus, isRunning, error, start };
}
