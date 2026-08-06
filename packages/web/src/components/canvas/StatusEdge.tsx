'use client';

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from 'reactflow';
import type { TaskStatus } from '@hermes/shared';

const colors: Record<TaskStatus, string> = { pending: '#94a3b8', running: '#3b82f6', success: '#22c55e', failed: '#ef4444', rollback: '#f59e0b' };
export type StatusEdgeData = { status?: TaskStatus };

export function StatusEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps<StatusEdgeData>) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const color = colors[data?.status ?? 'pending'];
  return <><BaseEdge id={id} path={path} style={{ stroke: color, strokeWidth: 2 }} markerEnd="url(#arrowhead)" /><EdgeLabelRenderer><span className="pointer-events-none absolute rounded bg-white px-1 text-[10px] text-zinc-500 dark:bg-zinc-950" style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}>{data?.status}</span></EdgeLabelRenderer></>;
}
