'use client';

import { useEffect, useState } from 'react';

type Stats = { tokens: unknown; cost: unknown; health: unknown; roundtable: unknown };
const emptyStats: Stats = { tokens: null, cost: null, health: null, roundtable: null };

export function useStats() {
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const load = async () => {
      setIsLoading(true);
      const endpoints = ['tokens', 'cost', 'health', 'roundtable'];
      const responses = await Promise.all(endpoints.map(async (endpoint) => {
        try {
          const response = await fetch(`/api/stats/${endpoint}`, { signal: controller.signal, cache: 'no-store' });
          return response.ok ? await response.json() : null;
        } catch { return null; }
      }));
      if (active) { setStats({ tokens: responses[0], cost: responses[1], health: responses[2], roundtable: responses[3] }); setIsLoading(false); }
    };
    void load();
    const interval = window.setInterval(load, 5000);
    return () => { active = false; controller.abort(); window.clearInterval(interval); };
  }, []);

  return { ...stats, isLoading };
}
