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
  RollbackHumanEscalation,
  ExperienceRecord,
  RoundtableConfig,
  RoundtableSpeech,
  RoundtableConsensus,
} from './types';

export interface ClientToServerEvents {
  'task:create': (data: { message: string }) => void;
  'roundtable:start': (data: RoundtableConfig) => void;
}

export interface ServerToClientEvents {
  'task:plan': (data: {
    tasks: SubTask[];
    reasoning?: string;
    source?: 'llm' | 'rules';
  }) => void;
  'agent:status': (data: AgentStatus) => void;
  'agent:output': (data: AgentOutput) => void;
  'agent:stream': (data: { taskId: string; agent: string; chunk: string }) => void;
  'agent:trace': (data: AgentTraceRecord) => void;
  'agent:snapshot': (data: AgentSnapshot) => void;
  'agent:error': (data: AgentErrorInfo) => void;
  'validator:result': (data: ValidatorResult) => void;
  'rollback:start': (data: RollbackEvent) => void;
  'rollback:complete': (data: RollbackResult) => void;
  'rollback:human': (data: RollbackHumanEscalation) => void;
  'memory:updated': (data: ExperienceRecord) => void;
  'roundtable:speech': (data: RoundtableSpeech) => void;
  'roundtable:consensus': (data: RoundtableConsensus) => void;
  'error': (data: { message: string }) => void;
}
