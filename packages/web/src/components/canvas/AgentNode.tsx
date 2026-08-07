'use client';

import { Handle, Position, type NodeProps } from 'reactflow';
import { motion } from 'framer-motion';
import { Bot, CheckCircle2, CircleAlert, LoaderCircle, RotateCcw } from 'lucide-react';
import type { SubTask } from '@hermes/shared';
import { cn } from '@/lib/cn';

const statusColors: Record<string, { border: string; bg: string; bar: string }> = {
  pending: { border: 'var(--border-color)', bg: 'var(--bg-card)', bar: 'var(--accent-muted)' },
  running: { border: 'var(--accent-info)', bg: 'var(--bg-card)', bar: 'var(--accent-info)' },
  success: { border: 'var(--success)', bg: 'var(--bg-card)', bar: 'var(--success)' },
  failed: { border: 'var(--error)', bg: 'var(--bg-card)', bar: 'var(--error)' },
  rollback: { border: 'var(--warning)', bg: 'var(--bg-card)', bar: 'var(--warning)' },
};

export function AgentNode({ data }: NodeProps<SubTask>) {
  const status = data.status;
  const progress = (data as SubTask & { progress?: number }).progress ?? 0;
  const colors = statusColors[status] ?? statusColors.pending;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      animate={{ scale: status === 'running' ? [1, 1.01, 1] : 1 }}
      transition={{ duration: status === 'running' ? 1.4 : 0.2, repeat: status === 'running' ? Infinity : 0 }}
      className="relative w-[200px] rounded-lg border p-3"
      style={{ background: colors.bg, borderColor: colors.border, color: 'var(--text-primary)', borderRadius: 'var(--radius-md)' }}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-2 !bg-current" style={{ borderColor: 'var(--bg-card)' }} />
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
          <Bot className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{data.agent}</p>
          <p className="truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>{data.id}</p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 min-h-10 text-sm font-medium">{data.title}</p>
      <div className="mt-3 flex items-center justify-between text-[11px]" style={{ color: 'var(--text-muted)' }}>
        <span className="flex items-center gap-1">
          {status === 'running' ? <LoaderCircle className="h-3 w-3 animate-spin" style={{ color: 'var(--accent-info)' }} />
            : status === 'success' ? <CheckCircle2 className="h-3 w-3" style={{ color: 'var(--success)' }} />
            : status === 'failed' ? <CircleAlert className="h-3 w-3" style={{ color: 'var(--error)' }} />
            : status === 'rollback' ? <RotateCcw className="h-3 w-3" style={{ color: 'var(--warning)' }} />
            : <span className="h-2 w-2 rounded-full" style={{ background: 'var(--accent-muted)' }} />}
          {status}
        </span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full" style={{ background: 'var(--bg-secondary)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, progress))}%`, background: colors.bar }} />
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-2 !bg-current" style={{ borderColor: 'var(--bg-card)' }} />
    </motion.div>
  );
}
