'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = window.localStorage.getItem('hermes-theme');
    const enabled = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', enabled);
    const frame = window.requestAnimationFrame(() => setDark(enabled));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    window.localStorage.setItem('hermes-theme', next ? 'dark' : 'light');
    setDark(next);
  };

  const btn = (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`}
      className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs hover:opacity-70"
      style={{ color: 'var(--text-muted)' }}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {!collapsed && <span>{dark ? 'Light theme' : 'Dark theme'}</span>}
    </button>
  );

  return collapsed ? (
    <Tooltip>
      <TooltipTrigger asChild>{btn}</TooltipTrigger>
      <TooltipContent side="right">{dark ? 'Light theme' : 'Dark theme'}</TooltipContent>
    </Tooltip>
  ) : btn;
}
