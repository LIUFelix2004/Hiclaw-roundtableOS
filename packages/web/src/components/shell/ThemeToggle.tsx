'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size={collapsed ? 'icon' : 'sm'} onClick={toggle} aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`} className={collapsed ? '' : 'w-full justify-start'}>
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {!collapsed && <span>{dark ? 'Light theme' : 'Dark theme'}</span>}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{dark ? 'Light theme' : 'Dark theme'}</TooltipContent>
    </Tooltip>
  );
}
