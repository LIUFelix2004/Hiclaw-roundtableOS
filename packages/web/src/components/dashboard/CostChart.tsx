'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { numberValue, records } from './stats-data';

const palette = ['#333333', '#666666', '#999999', '#bbbbbb', '#dddddd'];

export function CostChart({ value }: { value: unknown }) {
  const data = records(value).map((item) => ({ name: String(item.model ?? item.name ?? 'Unknown'), value: numberValue(item.cost ?? item.value) })).filter((item) => item.value > 0);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="min-w-0 rounded-lg border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: 'var(--radius-md)' }}>
      <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Cost by model</h2>
      <div className="relative h-64">
        {data.length ? (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={65} outerRadius={90} paddingAngle={3}>
                  {data.map((item, index) => <Cell key={item.name} fill={palette[index % palette.length]} />)}
                </Pie>
                <Tooltip formatter={(entry) => `$${Number(entry ?? 0).toFixed(2)}`} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>${total.toFixed(2)}</span>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>No cost data available</div>
        )}
      </div>
    </div>
  );
}
