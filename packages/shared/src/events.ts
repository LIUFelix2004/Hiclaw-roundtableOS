import type {
  SubTask,
  AgentStatus,
  AgentOutput,
  ValidatorResult,
  RollbackEvent,
  RollbackCompleteEvent,
  RollbackHumanEvent,
  TraceSpan,
  AgentSnapshot,
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
  'agent:error': (data: { message: string; taskId?: string }) => void;
  'validator:result': (data: ValidatorResult) => void;
  'rollback:start': (data: RollbackEvent) => void;
  'rollback:complete': (data: RollbackCompleteEvent) => void;
  'rollback:human': (data: RollbackHumanEvent) => void;
  'agent:trace': (data: TraceSpan | { taskId: string; span: TraceSpan }) => void;
  'agent:snapshot': (data: AgentSnapshot) => void;
  'roundtable:speech': (data: RoundtableSpeech) => void;
  'roundtable:consensus': (data: RoundtableConsensus) => void;
  'error': (data: { message: string }) => void;
}
