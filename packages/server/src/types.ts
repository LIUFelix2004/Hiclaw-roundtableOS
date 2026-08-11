import type {
  AgentRole,
  SubTask,
  TaskStatus,
  AgentStatus,
  AgentOutput,
  ValidatorResult,
  ErrorType,
  TraceSpan,
} from '@hermes/shared';

/* Internal extended types for server-side scheduling */

export interface AgentConfig {
  role: AgentRole;
  model: string;
  systemPrompt: string;
  tools?: string[];
  temperature?: number;
  maxTokens?: number;
  retryCount: number;
  timeout: number;
}

export interface AgentResult {
  taskId: string;
  role: AgentRole;
  output: string;
  tokens: number;
  cost: number;
  duration: number;
  model?: string;
  provider?: string;
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Structured context injected by the Runtime into every Skill Agent.
 * Replaces the legacy `(task: string, context: string)` prompt signature.
 */
export interface AgentContext {
  taskId: string;
  task: string;
  inputData?: unknown;
  previousResults?: Array<{ agent: string; result: unknown }>;
  memory?: unknown;
  snapshotId?: string;
  traceId?: string;
}

/**
 * Declarative Skill definition consumed by Runtime for versioning,
 * A/B testing and automatic rollback.
 */
export interface SkillDefinition {
  name: string;
  version: string;
  description: string;
  taskType: string;
  complexity: 'low' | 'medium' | 'high';
  model: string;
  capabilities: string[];
  inputSchema: unknown;
  outputSchema: unknown;
}

export interface PlanResult {
  tasks: SubTask[];
  reasoning: string;
  source?: 'llm' | 'rules';
}

export interface ExecutionContext {
  socketId: string;
  emit: (event: string, data: any) => void;
}

export type AgentConstructor = {
  config: AgentConfig;
};

export { AgentRole, SubTask, TaskStatus, AgentStatus, AgentOutput, ValidatorResult, ErrorType, TraceSpan };
