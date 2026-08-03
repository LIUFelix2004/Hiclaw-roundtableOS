export type AgentRole =
  | 'data'
  | 'research'
  | 'analyst'
  | 'writer'
  | 'moderator'
  | 'validator';

export type TaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'rollback';

export type ErrorType = 'DATA_ERROR' | 'MODEL_ERROR' | 'TOOL_ERROR' | 'POLICY_ERROR';

export interface SubTask {
  id: string;
  title: string;
  agent: AgentRole;
  dependsOn: string[];
  status: TaskStatus;
}

export interface AgentStatus {
  taskId: string;
  agent: AgentRole;
  status: TaskStatus;
  progress: number;
  model: string;
}

export interface AgentOutput {
  taskId: string;
  agent: AgentRole;
  content: string;
  tokens: number;
  cost: number;
  duration: number;
}

export interface ValidatorResult {
  taskId: string;
  agent?: AgentRole;
  pass: boolean;
  scores: {
    accuracy: number;
    completeness: number;
    safety: number;
    format: number;
  };
  failCodes?: ErrorType[];
  issues?: string[];
  reason?: string;
}

export interface RollbackEvent {
  taskId: string;
  errorType: ErrorType;
  fromModel: string;
  toModel: string;
}

export interface RoundtableConfig {
  topic: string;
  agents: AgentRole[];
  maxRounds?: number;
}

export type RoundtableStance =
  | 'propose'
  | 'agree'
  | 'challenge'
  | 'supplement'
  | 'moderate'
  | 'synthesize';

export interface RoundtableSpeech {
  round: number;
  agent: AgentRole;
  model: string;
  content: string;
  stance: RoundtableStance;
}

export interface RoundtableTask {
  agent: string;
  objective: string;
  input: string;
  expectedOutput: string;
  deadline?: string;
}

export interface RoundtableConsensus {
  rounds: number;
  finalAnswer: string;
  agreements: string[];
  disagreements: string[];
  finalSolution?: string;
  executionTasks?: RoundtableTask[];
  risks?: string[];
}

export interface ExperienceRecord {
  id: string;
  taskType: string;
  agent: AgentRole;
  model: string;
  success: boolean;
  failReason?: string;
  timestamp: number;
}

export interface TraceSpan {
  id: string;
  traceId: string;
  parentId?: string;
  name: string;
  agent?: AgentRole;
  startTime: number;
  endTime?: number;
  tokens?: number;
  cost?: number;
  status: TaskStatus;
}

export interface AgentTraceRecord {
  traceId: string;
  agent: AgentRole;
  model: string;
  tokens?: number;
  cost?: number;
  duration?: number;
  status: TaskStatus;
  phase?:
    | 'START'
    | 'CONTEXT_BUILD'
    | 'MODEL_SELECTED'
    | 'LLM_CALL'
    | 'OUTPUT_VALIDATE'
    | 'SNAPSHOT'
    | 'SUCCESS'
    | 'FAIL';
  attempt?: number;
  message?: string;
}

export interface AgentSnapshot {
  snapshotId: string;
  agent: AgentRole;
  timestamp: number;
  input: unknown;
  output?: unknown;
  model: string;
  status?: TaskStatus;
  error?: unknown;
}

export interface AgentErrorInfo {
  taskId: string;
  agent: AgentRole;
  errorType: ErrorType;
  message: string;
}
