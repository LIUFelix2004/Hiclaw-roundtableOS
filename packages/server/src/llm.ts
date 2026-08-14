import OpenAI from 'openai';
import type { AgentRole } from '@hermes/shared';
import { MOCK_TEMPLATES, calcCost } from '@hermes/shared';

export type ModelProvider = 'openai' | 'anthropic' | 'deepseek' | 'mock';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder',
  baseURL: process.env.OPENAI_BASE_URL,
});

export const MODEL_FALLBACKS: Record<AgentRole, string[]> = {
  data: [process.env.MODEL_DATA || 'gpt-5.5', 'gpt-5.4'],
  research: [process.env.MODEL_RESEARCH || 'gpt-5.5', 'gpt-5.4'],
  analyst: [process.env.MODEL_ANALYST || 'gpt-5.5', 'gpt-5.4'],
  writer: [process.env.MODEL_WRITER || 'gpt-5.5', 'gpt-5.4'],
  moderator: [process.env.MODEL_MODERATOR || 'gpt-5.5', 'gpt-5.4'],
  validator: [process.env.MODEL_VALIDATOR || 'gpt-5.5', 'gpt-5.4'],
  rollback: [process.env.MODEL_ROLLBACK || 'gpt-5.5', 'gpt-5.4'],
};

/**
 * The Planner drives task decomposition rather than a DAG node, so it is not an
 * AgentRole. It still needs its own model slot; MODEL_PLANNER is documented in
 * .env.example and is honoured here.
 */
export type ChatRole = AgentRole | 'planner';

const PLANNER_MODELS = [process.env.MODEL_PLANNER || 'gpt-5.5', 'gpt-5.4'];

function modelsFor(role: ChatRole): string[] {
  return role === 'planner' ? PLANNER_MODELS : MODEL_FALLBACKS[role] ?? [];
}

export function getDefaultModel(role: ChatRole): string {
  return modelsFor(role)[0] ?? 'gpt-5.5';
}

export interface ChatOptions {
  role: ChatRole;
  model?: string;
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  onChunk?: (chunk: string) => void;
}

export interface ChatResult {
  content: string;
  tokens: number;
  cost: number;
  model: string;
  /**
   * Usage breakdown consumed by SkillAgent when it emits agent:output and
   * agent:trace. AgentOutput / AgentTraceRecord in @hermes/shared already
   * declare these fields, so chat() has to supply them or the dashboard shows
   * blanks for provider and per-direction token counts.
   */
  provider: ModelProvider;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Mock mode: MOCK_LLM=1 forces built-in demo data.
 * If no OPENAI_API_KEY is configured, mock mode is enabled automatically
 * so the demo can run offline without any model gateway.
 */
export function isMockEnabled(): boolean {
  return process.env.MOCK_LLM === '1' || !process.env.OPENAI_API_KEY;
}

export function resolveProvider(model?: string): ModelProvider {
  const prefix = model?.split(':')[0];
  if (prefix === 'openai' || prefix === 'anthropic' || prefix === 'deepseek') {
    return prefix;
  }
  const explicit = (process.env.LLM_PROVIDER || 'auto').toLowerCase();
  if (explicit === 'openai' || explicit === 'anthropic' || explicit === 'deepseek') {
    return explicit;
  }
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.DEEPSEEK_API_KEY) return 'deepseek';
  return 'openai';
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) ?? []).length;
  const other = Math.max(0, text.length - cjk);
  return Math.max(1, Math.ceil(cjk * 0.9 + other / 4));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mockChat(options: ChatOptions): Promise<ChatResult> {
  const model = options.model ?? getDefaultModel(options.role);
  const task = options.messages.map((m) => m.content).join('\n');
  const template =
    options.role === 'planner' ? undefined : MOCK_TEMPLATES[options.role];
  const content = template ? template(task) : task;

  // Simulate streaming so the canvas shows the same UX as real model calls.
  const chunkSize = 6;
  for (let i = 0; i < content.length; i += chunkSize) {
    options.onChunk?.(content.slice(i, i + chunkSize));
    await sleep(8);
  }

  const inputTokens = Math.ceil(task.length / 4);
  const outputTokens = Math.ceil(content.length / 4);
  const cost = calcCost(model, inputTokens, outputTokens);

  return {
    content,
    tokens: inputTokens + outputTokens,
    cost,
    model,
    provider: 'mock',
    inputTokens,
    outputTokens,
  };
}

export async function chat(options: ChatOptions): Promise<ChatResult> {
  const model = options.model ?? getDefaultModel(options.role);

  if (isMockEnabled()) {
    return mockChat(options);
  }

  const response = await openai.chat.completions.create(
    {
      model,
      messages: [
        { role: 'system', content: options.systemPrompt },
        ...options.messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: false,
    },
    { signal: options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined },
  );

  const content = response.choices[0]?.message?.content ?? '';
  if (content && options.onChunk) options.onChunk(content);

  // Prefer the provider's own usage numbers; fall back to the CJK-aware
  // estimator when the gateway omits them.
  const inputText =
    options.systemPrompt + options.messages.map((m) => m.content).join('\n');
  const inputTokens = response.usage?.prompt_tokens ?? estimateTokens(inputText);
  const outputTokens = response.usage?.completion_tokens ?? estimateTokens(content);
  const cost = calcCost(model, inputTokens, outputTokens);

  return {
    content,
    tokens: response.usage?.total_tokens ?? inputTokens + outputTokens,
    cost,
    model,
    provider: resolveProvider(options.model),
    inputTokens,
    outputTokens,
  };
}
