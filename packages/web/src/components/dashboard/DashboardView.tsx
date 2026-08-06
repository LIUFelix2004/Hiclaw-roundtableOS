'use client';

import { useStats } from '@/hooks/useStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KPICards } from './KPICards';
import { TokenChart } from './TokenChart';
import { CostChart } from './CostChart';
import { records } from './stats-data';

function LoadingBlock() { return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="skeleton-shimmer h-20 rounded-lg bg-zinc-200 dark:bg-zinc-800 sm:col-span-2 xl:col-span-4" /></div>; }
export function DashboardView() {
  const stats = useStats();
  const history = records(stats.roundtable);
  const experience = records(stats.roundtable && typeof stats.roundtable === 'object' ? (stats.roundtable as Record<string, unknown>).experience : null);
  return <section className="min-h-full bg-zinc-50 p-4 dark:bg-zinc-950 sm:p-6"><div className="mx-auto max-w-6xl space-y-5"><header><p className="text-xs font-medium uppercase tracking-wider text-emerald-600">Operations</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Dashboard</h1><p className="mt-1 text-sm text-zinc-500">System usage, cost, health, and roundtable history. Refreshes every 5 seconds.</p></header>{stats.isLoading && !stats.tokens && !stats.cost ? <LoadingBlock /> : <KPICards tokens={stats.tokens} cost={stats.cost} health={stats.health} roundtable={stats.roundtable} />}<div className="grid gap-4 lg:grid-cols-2"><TokenChart value={stats.tokens} /><CostChart value={stats.cost} /></div><div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">Roundtable history</CardTitle></CardHeader><CardContent>{history.length ? <div className="divide-y divide-zinc-200 dark:divide-zinc-800">{history.map((item, index) => <div key={String(item.id ?? index)} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="truncate">{String(item.topic ?? item.taskType ?? 'Roundtable session')}</span><span className="shrink-0 text-xs text-zinc-500">{item.success === false ? 'Needs review' : 'Completed'}</span></div>)}</div> : <p className="text-sm text-zinc-500">No roundtable history available.</p>}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">Experience memory</CardTitle></CardHeader><CardContent>{experience.length ? <div className="divide-y divide-zinc-200 dark:divide-zinc-800">{experience.map((item, index) => <div key={String(item.id ?? index)} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="truncate">{String(item.taskType ?? item.agent ?? 'Experience record')}</span><span className={item.success === false ? 'text-red-600' : 'text-emerald-600'}>{item.success === false ? 'Failed' : 'Success'}</span></div>)}</div> : <p className="text-sm text-zinc-500">No experience records available.</p>}</CardContent></Card></div></div></section>;
}
