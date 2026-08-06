'use client';

import { Handle, Position, type NodeProps } from 'reactflow';
import { motion } from 'framer-motion';
import { Bot, CheckCircle2, CircleAlert, LoaderCircle, RotateCcw } from 'lucide-react';
import type { SubTask } from '@hermes/shared';
import { cn } from '@/lib/cn';

const statusStyles = { pending: 'border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900', running: 'border-blue-500 bg-blue-50 shadow-[0_0_18px_rgba(59,130,246,.35)] dark:bg-blue-950/30', success: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30', failed: 'border-red-500 bg-red-50 dark:bg-red-950/30', rollback: 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' } as const;

export function AgentNode({ data }: NodeProps<SubTask>) {
  const status = data.status;
  const progress = (data as SubTask & { progress?: number }).progress ?? 0;
  return <motion.div whileHover={{ y: -2 }} animate={{ scale: status === 'running' ? [1, 1.02, 1] : 1 }} transition={{ duration: status === 'running' ? 1.4 : 0.2, repeat: status === 'running' ? Infinity : 0 }} className={cn('relative w-[200px] rounded-lg border p-3 text-zinc-900 transition-shadow dark:text-zinc-100', statusStyles[status])}>
    <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-2 !border-white !bg-zinc-500 dark:!border-zinc-900" />
    <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-blue-600 dark:bg-zinc-900"><Bot className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate text-xs font-semibold">{data.agent}</p><p className="truncate text-[11px] text-zinc-500">{data.id}</p></div></div>
    <p className="mt-3 line-clamp-2 min-h-10 text-sm font-medium">{data.title}</p>
    <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500"><span className="flex items-center gap-1">{status === 'running' ? <LoaderCircle className="h-3 w-3 animate-spin text-blue-500" /> : status === 'success' ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : status === 'failed' ? <CircleAlert className="h-3 w-3 text-red-500" /> : status === 'rollback' ? <RotateCcw className="h-3 w-3 text-amber-500" /> : <span className="h-2 w-2 rounded-full bg-zinc-400" />}{status}</span><span>{Math.round(progress)}%</span></div>
    <div className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"><div className={cn('h-full rounded-full transition-all', status === 'failed' ? 'bg-red-500' : status === 'success' ? 'bg-emerald-500' : status === 'rollback' ? 'bg-amber-500' : 'bg-blue-500')} style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>
    <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-2 !border-white !bg-zinc-500 dark:!border-zinc-900" />
  </motion.div>;
}
