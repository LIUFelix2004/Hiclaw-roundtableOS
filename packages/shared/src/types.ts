export type AgentRole = 'data' | 'research' | 'analyst' | 'writer';

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
  pass: boolean;
  scores: {
    accuracy: number;
    completeness: number;
    safety: number;
    format: number;
  };
  reason?: string;
}

export interface RollbackEvent {
  taskId: string;
  errorType: ErrorType;
  fromModel: string;
  toModel: string;
}

export type RollbackStrategy = 'snapshot_restore' | 'model_switch' | 'rerun' | 'human_escalation';

export interface RollbackCompleteEvent {
  taskId: string;
  strategy: RollbackStrategy;
  result: string;
  fromModel?: string;
  toModel?: string;
}

export interface RollbackHumanEvent {
  taskId: string;
  reason: string;
  context?: string;
}

export interface RoundtableConfig {
  topic: string;
  agents: AgentRole[];
  maxRounds?: number;
}

export interface RoundtableSpeech {
  round: number;
  agent: AgentRole;
  model: string;
  content: string;
  stance: 'propose' | 'agree' | 'challenge' | 'supplement' | 'moderate' | 'synthesize';
}

export interface RoundtableConsensus {
  rounds: number;
  finalAnswer: string;
  agreements: string[];
  disagreements: string[];
  tasks?: { agent: AgentRole; target: string; input: string; expectedOutput: string }[];
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

export interface AgentSnapshot {
  id: string;
  taskId: string;
  label: string;
  timestamp: number;
  data: Record<string, unknown>;
}
