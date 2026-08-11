import type {
  AgentSnapshot,
  AgentTraceRecord,
  RollbackCompleteEvent,
  RollbackHumanEscalation,
  RollbackHumanEvent,
  RollbackResult,
  RollbackStrategy,
  TraceSpan,
} from '@hermes/shared';

export interface RollbackCompleteView {
  taskId: string;
  strategy: RollbackStrategy;
  result: string;
  fromModel?: string;
  toModel?: string;
}

export function toRollbackCompleteView(
  event: RollbackResult | RollbackCompleteEvent,
): RollbackCompleteView {
  if ('result' in event) return event;
  return {
    taskId: event.taskId,
    strategy: event.strategy,
    result: `${event.reason}${event.recovered ? '' : ' (escalated)'}`,
    fromModel: event.fromModel,
    toModel: event.toModel,
  };
}

export interface RollbackHumanView {
  taskId: string;
  reason: string;
  context?: string;
}

export function toRollbackHumanView(
  event: RollbackHumanEscalation | RollbackHumanEvent,
): RollbackHumanView {
  if ('reason' in event) {
    return { taskId: event.taskId, reason: event.reason, context: event.context };
  }
  return { taskId: event.taskId, reason: event.message, context: event.instructions };
}

export function toTraceSpan(
  payload: AgentTraceRecord | TraceSpan | { taskId: string; span: TraceSpan },
): TraceSpan {
  if ('span' in payload) return payload.span;
  if ('startTime' in payload) return payload;
  const record = payload as AgentTraceRecord;
  const startTime = Date.now() - (record.duration ?? 0);
  return {
    id: `${record.traceId}:${record.phase ?? 'phase'}:${record.attempt ?? 0}`,
    traceId: record.traceId,
    name: record.phase ?? 'AGENT',
    agent: record.agent,
    startTime,
    endTime: record.duration !== undefined ? startTime + record.duration : undefined,
    tokens: record.tokens,
    cost: record.cost,
    status: record.status,
  };
}

export interface SnapshotView {
  id: string;
  label: string;
  data?: unknown;
}

export function toSnapshotView(snapshot: AgentSnapshot): SnapshotView {
  return {
    id: snapshot.id ?? snapshot.snapshotId ?? snapshot.taskId,
    label: snapshot.label ?? snapshot.agent ?? snapshot.taskId,
    data: snapshot.data ?? { input: snapshot.input, output: snapshot.output },
  };
}
