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
}

export interface PlanResult {
  tasks: SubTask[];
  reasoning: string;
}

export interface ExecutionContext {
  socketId: string;
  emit: (event: string, data: any) => void;
}

export type AgentConstructor = {
  config: AgentConfig;
};

export { AgentRole, SubTask, TaskStatus, AgentStatus, AgentOutput, ValidatorResult, ErrorType, TraceSpan };
