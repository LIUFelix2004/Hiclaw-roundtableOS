'use client';

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { records, numberValue } from './stats-data';

const colors = { data: '#3b82f6', research: '#22c55e', analyst: '#8b5cf6', writer: '#f59e0b' };
export function TokenChart({ value }: { value: unknown }) {
  const data = records(value).map((item, index) => ({ time: String(item.time ?? item.timestamp ?? index + 1), data: numberValue(item.data), research: numberValue(item.research), analyst: numberValue(item.analyst), writer: numberValue(item.writer) }));
  return <Card className="min-w-0"><CardHeader><CardTitle className="text-base">Token usage</CardTitle></CardHeader><CardContent><div className="h-64">{data.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" /><XAxis dataKey="time" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />{Object.entries(colors).map(([key, color]) => <Area key={key} type="monotone" dataKey={key} stackId="1" stroke={color} fill={color} fillOpacity={0.2} />)}</AreaChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-zinc-500">No token history available</div>}</div></CardContent></Card>;
}
