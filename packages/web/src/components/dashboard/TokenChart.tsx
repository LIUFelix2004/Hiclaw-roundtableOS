'use client';

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { records, numberValue } from './stats-data';

const colors = { data: '#666666', research: '#999999', analyst: '#444444', writer: '#bbbbbb' };

export function TokenChart({ value }: { value: unknown }) {
  const data = records(value).map((item, index) => ({ time: String(item.time ?? item.timestamp ?? index + 1), data: numberValue(item.data), research: numberValue(item.research), analyst: numberValue(item.analyst), writer: numberValue(item.writer) }));
  return (
    <div className="min-w-0 rounded-lg border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: 'var(--radius-md)' }}>
      <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Token usage</h2>
      <div className="h-64">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {Object.entries(colors).map(([key, color]) => <Area key={key} type="monotone" dataKey={key} stackId="1" stroke={color} fill={color} fillOpacity={0.15} />)}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>No token history available</div>
        )}
      </div>
    </div>
  );
}
