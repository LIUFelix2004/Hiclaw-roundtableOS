import type {
  SubTask,
  AgentStatus,
  AgentOutput,
  AgentTraceRecord,
  AgentSnapshot,
  AgentErrorInfo,
  ValidatorResult,
  RollbackEvent,
  RollbackResult,
  RollbackCompleteEvent,
  RollbackHumanEscalation,
  RollbackHumanEvent,
  ExperienceRecord,
  TraceSpan,
  RoundtableConfig,
  RoundtableSpeech,
  RoundtableConsensus,
} from './types';

export interface ClientToServerEvents {
  'task:create': (data: { message: string }) => void;
  'roundtable:start': (data: RoundtableConfig) => void;
  'rollback:respond': (data: { taskId: string; action: 'approve' | 'dismiss' }) => void;
}

export interface ServerToClientEvents {
  'task:plan': (data: { tasks: SubTask[] }) => void;
  'agent:status': (data: AgentStatus) => void;
  'agent:output': (data: AgentOutput) => void;
  'agent:stream': (data: { taskId: string; agent: string; chunk: string }) => void;
  'agent:trace': (data: AgentTraceRecord | TraceSpan | { taskId: string; span: TraceSpan }) => void;
  'agent:snapshot': (data: AgentSnapshot) => void;
  'agent:error': (data: AgentErrorInfo | { message: string; taskId?: string }) => void;
  'validator:result': (data: ValidatorResult) => void;
  'rollback:start': (data: RollbackEvent) => void;
  'rollback:complete': (data: RollbackResult | RollbackCompleteEvent) => void;
  'rollback:human': (data: RollbackHumanEscalation | RollbackHumanEvent) => void;
  'memory:updated': (data: ExperienceRecord) => void;
  'roundtable:speech': (data: RoundtableSpeech) => void;
  'roundtable:consensus': (data: RoundtableConsensus) => void;
  'error': (data: { message: string }) => void;
}
