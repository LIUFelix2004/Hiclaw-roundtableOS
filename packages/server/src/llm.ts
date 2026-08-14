import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { AgentRole } from '@hermes/shared';
import { MOCK_TEMPLATES, calcCost } from '@hermes/shared';

export type ModelProvider = 'openai' | 'anthropic' | 'deepseek' | 'mock';

/**
 * Clients are built lazily so that importing this module never requires a key.
 * DeepSeek speaks the OpenAI wire format, so it reuses the OpenAI SDK with its
 * own base URL; Anthropic has its own protocol and uses the official SDK.
 */
const clients: { openai?: OpenAI; deepseek?: OpenAI; anthropic?: Anthropic } = {};

function openaiClient(): OpenAI {
  return (clients.openai ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder',
    baseURL: process.env.OPENAI_BASE_URL,
  }));
}

function deepseekClient(): OpenAI {
  return (clients.deepseek ??= new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY || 'sk-placeholder',
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  }));
}

function anthropicClient(): Anthropic {
  return (clients.anthropic ??= new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
  }));
}

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

export function hasProviderKey(provider: ModelProvider): boolean {
  switch (provider) {
    case 'openai':
      return !!process.env.OPENAI_API_KEY;
    case 'anthropic':
      return !!process.env.ANTHROPIC_API_KEY;
    case 'deepseek':
      return !!process.env.DEEPSEEK_API_KEY;
    default:
      return true;
  }
}

/**
 * Mock mode: MOCK_LLM=1 forces built-in demo data, and so does having no
 * provider key at all.
 *
 * This deliberately checks every supported provider rather than OPENAI_API_KEY
 * alone: configuring only ANTHROPIC_API_KEY used to leave the system silently
 * in mock mode, so a demo looked live while still replaying canned data.
 */
export function isMockEnabled(): boolean {
  if (process.env.MOCK_LLM === '1') return true;
  return !(
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.DEEPSEEK_API_KEY
  );
}

/** The providers `chat()` can actually dispatch to (mock is a separate mode). */
export type LiveProvider = Exclude<ModelProvider, 'mock'>;

export function resolveProvider(model?: string): LiveProvider {
  const prefix = model?.split(':')[0];
  if (prefix === 'openai' || prefix === 'anthropic' || prefix === 'deepseek') {
    return prefix;
  }
  const explicit = (process.env.LLM_PROVIDER || 'auto').toLowerCase();
  if (explicit === 'openai' || explicit === 'anthropic' || explicit === 'deepseek') {
    return explicit;
  }
  // auto: prefer a provider whose key is actually present.
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.DEEPSEEK_API_KEY) return 'deepseek';
  return 'openai';
}

/** `anthropic:claude-opus-5` -> `claude-opus-5`. */
export function stripProviderPrefix(model: string): string {
  const [head, ...rest] = model.split(':');
  return head === 'openai' || head === 'anthropic' || head === 'deepseek'
    ? rest.join(':')
    : model;
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

function inputTextOf(options: ChatOptions): string {
  return options.systemPrompt + options.messages.map((m) => m.content).join('\n');
}

/** OpenAI and DeepSeek share the same wire format. */
async function openAiCompatibleChat(
  options: ChatOptions,
  provider: 'openai' | 'deepseek',
  model: string,
): Promise<ChatResult> {
  const client = provider === 'deepseek' ? deepseekClient() : openaiClient();
  const response = await client.chat.completions.create(
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
  const inputTokens = response.usage?.prompt_tokens ?? estimateTokens(inputTextOf(options));
  const outputTokens = response.usage?.completion_tokens ?? estimateTokens(content);

  return {
    content,
    tokens: response.usage?.total_tokens ?? inputTokens + outputTokens,
    cost: calcCost(model, inputTokens, outputTokens),
    model,
    provider,
    inputTokens,
    outputTokens,
  };
}

async function anthropicChat(options: ChatOptions, model: string): Promise<ChatResult> {
  const response = await anthropicClient().messages.create(
    {
      model,
      // Claude counts thinking against max_tokens, and thinking is on by
      // default on current models. Agents ask for 4096 to hold a JSON payload,
      // which would leave almost nothing for the answer — so give a floor.
      max_tokens: Math.max(options.maxTokens ?? 2048, 8192),
      system: options.systemPrompt,
      messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
      // temperature is rejected by current Claude models; steer via the prompt.
    },
    { signal: options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined },
  );

  if (response.stop_reason === 'refusal') {
    throw new Error(
      `POLICY_ERROR: Anthropic 安全策略拒绝了该请求 (${response.stop_details?.category ?? 'unknown'})`,
    );
  }

  const content = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
  if (content && options.onChunk) options.onChunk(content);

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;

  return {
    content,
    tokens: inputTokens + outputTokens,
    cost: calcCost(model, inputTokens, outputTokens),
    model,
    provider: 'anthropic',
    inputTokens,
    outputTokens,
  };
}

export async function chat(options: ChatOptions): Promise<ChatResult> {
  const requested = options.model ?? getDefaultModel(options.role);

  if (isMockEnabled()) {
    return mockChat(options);
  }

  const provider = resolveProvider(requested);
  const model = stripProviderPrefix(requested);

  if (!hasProviderKey(provider)) {
    throw new Error(
      `MODEL_ERROR: 模型 ${requested} 需要 ${provider} 凭据，但对应的 API key 未配置`,
    );
  }

  return provider === 'anthropic'
    ? anthropicChat(options, model)
    : openAiCompatibleChat(options, provider, model);
}
