'use client';

import { useStats } from '@/hooks/useStats';
import { KPICards } from './KPICards';
import { TokenChart } from './TokenChart';
import { CostChart } from './CostChart';
import { records } from './stats-data';

function LoadingBlock() {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="skeleton-shimmer h-20 rounded-lg sm:col-span-2 xl:col-span-4" style={{ background: 'var(--bg-secondary)' }} /></div>;
}

export function DashboardView() {
  const stats = useStats();
  const history = records(stats.roundtable);
  const experience = records(stats.roundtable && typeof stats.roundtable === 'object' ? (stats.roundtable as Record<string, unknown>).experience : null);

  return (
    <section className="min-h-full p-4 sm:p-6" style={{ background: 'var(--bg-primary)' }}>
      <div className="mx-auto max-w-6xl space-y-5">
        <header>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Operations</p>
          <h1 className="mt-1 text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--text-secondary)' }}>System usage, cost, health, and roundtable history. Refreshes every 5 seconds.</p>
        </header>

        {stats.isLoading && !stats.tokens && !stats.cost ? <LoadingBlock /> : <KPICards tokens={stats.tokens} cost={stats.cost} health={stats.health} roundtable={stats.roundtable} />}

        <div className="grid gap-4 lg:grid-cols-2">
          <TokenChart value={stats.tokens} />
          <CostChart value={stats.cost} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Roundtable history */}
          <div className="rounded-lg border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: 'var(--radius-md)' }}>
            <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Roundtable history</h2>
            {history.length ? (
              <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
                {history.map((item, index) => (
                  <div key={String(item.id ?? index)} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="truncate" style={{ color: 'var(--text-primary)' }}>{String(item.topic ?? item.taskType ?? 'Roundtable session')}</span>
                    <span className="shrink-0 text-xs" style={{ color: item.success === false ? 'var(--error)' : 'var(--success)' }}>{item.success === false ? 'Needs review' : 'Completed'}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No roundtable history available.</p>}
          </div>

          {/* Experience memory */}
          <div className="rounded-lg border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: 'var(--radius-md)' }}>
            <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Experience memory</h2>
            {experience.length ? (
              <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
                {experience.map((item, index) => (
                  <div key={String(item.id ?? index)} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="truncate" style={{ color: 'var(--text-primary)' }}>{String(item.taskType ?? item.agent ?? 'Experience record')}</span>
                    <span className="text-xs" style={{ color: item.success === false ? 'var(--error)' : 'var(--success)' }}>{item.success === false ? 'Failed' : 'Success'}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No experience records available.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
