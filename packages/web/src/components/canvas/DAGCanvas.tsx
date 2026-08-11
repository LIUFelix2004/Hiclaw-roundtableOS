'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, { Background, Controls, MiniMap, MarkerType, Panel, ReactFlowProvider, useEdgesState, useNodesState, useReactFlow, type Edge, type Node } from 'reactflow';
import { toPng } from 'html-to-image';
import 'reactflow/dist/style.css';
import type { AgentSnapshot, AgentStatus, AgentTraceRecord, RollbackCompleteEvent, RollbackEvent, RollbackHumanEscalation, RollbackHumanEvent, RollbackResult, SubTask, TraceSpan } from '@hermes/shared';
import { useSocket } from '@/hooks/useSocket';
import { toRollbackCompleteView, toRollbackHumanView, toSnapshotView, toTraceSpan, type RollbackCompleteView, type RollbackHumanView, type SnapshotView } from '@/lib/events';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AgentNode } from './AgentNode';
import { StatusEdge, type StatusEdgeData } from './StatusEdge';
import { TracePanel } from '@/components/trace/TracePanel';
import { RollbackHumanDialog } from '@/components/rollback/RollbackHumanDialog';
import { RollbackNotice } from '@/components/rollback/RollbackNotice';

const nodeTypes = { agent: AgentNode };
const edgeTypes = { status: StatusEdge };

function layoutTasks(tasks: SubTask[]): { nodes: Node<SubTask>[]; edges: Edge<StatusEdgeData>[] } {
  const levels = new Map<string, number>();
  const levelOf = (task: SubTask, seen = new Set<string>()): number => {
    if (levels.has(task.id)) return levels.get(task.id)!;
    if (seen.has(task.id)) return 0;
    seen.add(task.id);
    const parents = tasks.filter((candidate) => task.dependsOn.includes(candidate.id));
    const level = parents.length ? Math.max(...parents.map((parent) => levelOf(parent, seen))) + 1 : 0;
    levels.set(task.id, level);
    return level;
  };
  tasks.forEach((task) => levelOf(task));
  const byLevel = new Map<number, SubTask[]>();
  tasks.forEach((task) => {
    const level = levels.get(task.id) ?? 0;
    byLevel.set(level, [...(byLevel.get(level) ?? []), task]);
  });
  const nodes = tasks.map((task) => {
    const level = levels.get(task.id) ?? 0;
    const row = byLevel.get(level)?.indexOf(task) ?? 0;
    return { id: task.id, type: 'agent', position: { x: level * 280, y: row * 140 }, data: task } as Node<SubTask>;
  });
  const edges = tasks.flatMap((task) => task.dependsOn.map((source) => ({ id: `${source}-${task.id}`, source, target: task.id, type: 'status', markerEnd: { type: MarkerType.ArrowClosed }, data: { status: task.status } } as Edge<StatusEdgeData>)));
  return { nodes, edges };
}

function CanvasInner() {
  const { on, off, emit } = useSocket();
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const [tasks, setTasks] = useState<SubTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [traceByTask, setTraceByTask] = useState<Record<string, TraceSpan[]>>({});
  const [snapshotsByTask, setSnapshotsByTask] = useState<Record<string, SnapshotView[]>>({});
  const [rollbackStarted, setRollbackStarted] = useState<RollbackEvent | null>(null);
  const [rollbackCompleted, setRollbackCompleted] = useState<RollbackCompleteView | null>(null);
  const [humanRollback, setHumanRollback] = useState<RollbackHumanView | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<SubTask>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<StatusEdgeData>([]);
  const applyTasks = useCallback((next: SubTask[]) => {
    setTasks(next);
    const layout = layoutTasks(next);
    setNodes(layout.nodes);
    setEdges(layout.edges);
  }, [setNodes, setEdges]);

  useEffect(() => {
    const plan = ({ tasks: next }: { tasks: SubTask[] }) => applyTasks(next);
    const status = (event: AgentStatus) => {
      setTasks((current) => {
        const next = current.map((task) => task.id === event.taskId ? { ...task, status: event.status, progress: event.progress } : task);
        const layout = layoutTasks(next);
        setNodes(layout.nodes);
        setEdges(layout.edges.map((edge) => ({ ...edge, data: { status: next.find((task) => task.id === edge.target)?.status } })));
        return next;
      });
    };
    const rollbackStart = (event: RollbackEvent) => {
      setRollbackStarted(event);
      setRollbackCompleted(null);
      setTasks((current) => {
        const next = current.map((task) => task.id === event.taskId ? { ...task, status: 'rollback' as const } : task);
        const layout = layoutTasks(next);
        setNodes(layout.nodes);
        setEdges(layout.edges);
        return next;
      });
    };
    const rollbackComplete = (event: RollbackResult | RollbackCompleteEvent) => { setRollbackCompleted(toRollbackCompleteView(event)); setRollbackStarted(null); };
    const rollbackHuman = (event: RollbackHumanEscalation | RollbackHumanEvent) => setHumanRollback(toRollbackHumanView(event));
    const trace = (payload: AgentTraceRecord | TraceSpan | { taskId: string; span: TraceSpan }) => {
      const span = toTraceSpan(payload);
      const taskId = 'span' in payload ? payload.taskId : span.traceId;
      setTraceByTask((current) => ({ ...current, [taskId]: [...(current[taskId] ?? []).filter((item) => item.id !== span.id), span] }));
    };
    const snapshot = (event: AgentSnapshot) => {
      const view = toSnapshotView(event);
      setSnapshotsByTask((current) => ({ ...current, [event.taskId]: [...(current[event.taskId] ?? []).filter((item) => item.id !== view.id), view] }));
    };
    on('task:plan', plan);
    on('agent:status', status);
    on('rollback:start', rollbackStart); on('rollback:complete', rollbackComplete); on('rollback:human', rollbackHuman); on('agent:trace', trace); on('agent:snapshot', snapshot);
    return () => { off('task:plan', plan); off('agent:status', status); off('rollback:start', rollbackStart); off('rollback:complete', rollbackComplete); off('rollback:human', rollbackHuman); off('agent:trace', trace); off('agent:snapshot', snapshot); };
  }, [on, off, applyTasks, setNodes, setEdges]);

  const saveImage = async () => {
    if (!canvasRef.current) return;
    const dataUrl = await toPng(canvasRef.current, { backgroundColor: document.documentElement.classList.contains('dark') ? '#09090b' : '#fafafa', pixelRatio: 2 });
    const link = document.createElement('a');
    link.download = `hermes-dag-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  const respondToRollback = (action: 'approve' | 'dismiss') => { if (humanRollback) emit('rollback:respond', { taskId: humanRollback.taskId, action }); setHumanRollback(null); };
  return <div ref={canvasRef} className="relative h-full min-h-[32rem]" style={{ background: 'var(--bg-primary)' }}>
    <RollbackNotice started={rollbackStarted} completed={rollbackCompleted} />
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={(_, node) => setSelectedTaskId(node.id)} fitView proOptions={{ hideAttribution: true }}>
      <Background gap={24} size={1} color="var(--border-light)" />
      <Controls showInteractive={false} />
      <MiniMap nodeColor={(node) => { const status = (node.data as SubTask | undefined)?.status; return status === 'success' ? '#2e7d32' : status === 'failed' ? '#c62828' : status === 'running' ? '#4a90d9' : '#888888'; }} />
      <Panel position="top-left"><div className="rounded-lg border p-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: 'var(--radius-md)' }}><p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>DAG Canvas</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{tasks.length ? `${tasks.length} tasks - live status` : 'Waiting for task plan...'}</p><div className="mt-2 flex gap-1"><Button variant="outline" size="sm" onClick={() => zoomOut()} aria-label="Zoom out">-</Button><Button variant="outline" size="sm" onClick={() => zoomIn()} aria-label="Zoom in">+</Button><Button variant="outline" size="sm" onClick={() => fitView({ padding: 0.2 })}>Fit</Button><Button variant="outline" size="sm" onClick={() => void saveImage()}>Screenshot</Button></div></div></Panel>
    </ReactFlow>
    {!tasks.length && <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="max-w-sm rounded-lg border p-6 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: 'var(--radius-md)' }}><h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>No task graph yet</h3><p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Send a task in Dialogue Center to generate the agent dependency graph.</p></div></div>}
    {selectedTaskId && <TracePanel taskId={selectedTaskId} spans={traceByTask[selectedTaskId] ?? []} snapshots={snapshotsByTask[selectedTaskId] ?? []} onClose={() => setSelectedTaskId(null)} />}
    <RollbackHumanDialog event={humanRollback} onRespond={respondToRollback} />
  </div>;
}

export function DAGCanvas() { return <ReactFlowProvider><CanvasInner /></ReactFlowProvider>; }
