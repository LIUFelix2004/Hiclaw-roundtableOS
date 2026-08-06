'use client';

import { Activity, CircleDollarSign, ListTodo, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { numberValue } from './stats-data';

export function KPICards({ tokens, cost, health, roundtable }: { tokens: unknown; cost: unknown; health: unknown; roundtable: unknown }) {
  const tokenTotal = numberValue(typeof tokens === 'object' && tokens ? (tokens as Record<string, unknown>).total : tokens);
  const costTotal = numberValue(typeof cost === 'object' && cost ? (cost as Record<string, unknown>).total : cost);
  const active = numberValue(typeof roundtable === 'object' && roundtable ? (roundtable as Record<string, unknown>).active : 0);
  const healthy = typeof health === 'object' && health ? (health as Record<string, unknown>).status === 'ok' || (health as Record<string, unknown>).healthy === true : false;
  const cards = [{ label: 'Total tokens', value: tokenTotal.toLocaleString(), suffix: 'tokens', icon: Zap, color: 'text-blue-600 bg-blue-100 dark:bg-blue-950' }, { label: 'Total cost', value: `$${costTotal.toFixed(2)}`, suffix: '', icon: CircleDollarSign, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-950' }, { label: 'Active tasks', value: active.toLocaleString(), suffix: '', icon: ListTodo, color: 'text-violet-600 bg-violet-100 dark:bg-violet-950' }, { label: 'System status', value: healthy ? 'Healthy' : 'Awaiting data', suffix: '', icon: Activity, color: healthy ? 'text-emerald-600 bg-emerald-100 dark:bg-emerald-950' : 'text-amber-600 bg-amber-100 dark:bg-amber-950' }];
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <Card key={card.label}><CardContent className="flex items-center gap-3 p-4"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${card.color}`}><card.icon className="h-5 w-5" /></span><div className="min-w-0"><p className="text-xs text-zinc-500">{card.label}</p><p className="truncate text-xl font-semibold">{card.value} <span className="text-xs font-normal text-zinc-500">{card.suffix}</span></p></div></CardContent></Card>)}</div>;
}
