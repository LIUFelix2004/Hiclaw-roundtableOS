'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { numberValue, records } from './stats-data';

const palette = ['#3b82f6', '#22c55e', '#8b5cf6', '#f59e0b', '#ef4444'];
export function CostChart({ value }: { value: unknown }) {
  const data = records(value).map((item) => ({ name: String(item.model ?? item.name ?? 'Unknown'), value: numberValue(item.cost ?? item.value) })).filter((item) => item.value > 0);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return <Card className="min-w-0"><CardHeader><CardTitle className="text-base">Cost by model</CardTitle></CardHeader><CardContent><div className="relative h-64">{data.length ? <><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={65} outerRadius={90} paddingAngle={3}>{data.map((item, index) => <Cell key={item.name} fill={palette[index % palette.length]} />)}</Pie><Tooltip formatter={(entry) => `$${Number(entry ?? 0).toFixed(2)}`} /></PieChart></ResponsiveContainer><span className="pointer-events-none absolute inset-0 flex items-center justify-center text-lg font-semibold">${total.toFixed(2)}</span></> : <div className="flex h-full items-center justify-center text-sm text-zinc-500">No cost data available</div>}</div></CardContent></Card>;
}
