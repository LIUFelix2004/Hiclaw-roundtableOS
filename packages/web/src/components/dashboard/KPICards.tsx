'use client';

import { Activity, CircleDollarSign, ListTodo, Zap } from 'lucide-react';
import { numberValue } from './stats-data';

export function KPICards({ tokens, cost, health, roundtable }: { tokens: unknown; cost: unknown; health: unknown; roundtable: unknown }) {
  const tokenTotal = numberValue(typeof tokens === 'object' && tokens ? (tokens as Record<string, unknown>).total : tokens);
  const costTotal = numberValue(typeof cost === 'object' && cost ? (cost as Record<string, unknown>).total : cost);
  const active = numberValue(typeof roundtable === 'object' && roundtable ? (roundtable as Record<string, unknown>).active : 0);
  const healthy = typeof health === 'object' && health ? (health as Record<string, unknown>).status === 'ok' || (health as Record<string, unknown>).healthy === true : false;

  const cards = [
    { label: 'Total tokens', value: tokenTotal.toLocaleString(), suffix: 'tokens', icon: Zap },
    { label: 'Total cost', value: `$${costTotal.toFixed(2)}`, suffix: '', icon: CircleDollarSign },
    { label: 'Active tasks', value: active.toLocaleString(), suffix: '', icon: ListTodo },
    { label: 'System status', value: healthy ? 'Healthy' : 'Awaiting data', suffix: '', icon: Activity },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="flex items-center gap-3 rounded-lg border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: 'var(--radius-md)' }}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
            <card.icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{card.label}</p>
            <p className="truncate text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {card.value} <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>{card.suffix}</span>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
