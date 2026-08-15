import { calcCost } from '@hermes/shared';

/**
 * AI 网关 LLM 调用（T3.1）。
 *
 * 对接 hiclaw 的 Higress AI 网关（OpenAI 兼容端点 /v1），
 * 模型名走网关侧映射：deepseek-chat → deepseek-v4-pro（01 §1.4 实测）。
 * key-auth consumer 密钥来自 hiclaw worker-creds 的 WORKER_GATEWAY_KEY。
 *
 * 环境变量：
 *  - HICLAW_GATEWAY_BASE_URL  网关地址（默认 http://127.0.0.1:18080/v1）
 *  - HICLAW_GATEWAY_KEY       key-auth consumer 密钥（缺省时离线兜底）
 *  - HICLAW_PLANNER_MODEL     Planner 使用的模型（默认 deepseek-v4-pro）
 *  - MOCK_LLM=1               强制离线
 */

export const GATEWAY_DEFAULT_BASE_URL = 'http://127.0.0.1:18080/v1';
export const GATEWAY_DEFAULT_MODEL = 'deepseek-v4-pro';

export interface GatewayChatOptions {
  model?: string;
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface GatewayChatResult {
  content: string;
  tokens: number;
  cost: number;
  model: string;
}

export function gatewayBaseUrl(): string {
  return (process.env.HICLAW_GATEWAY_BASE_URL || GATEWAY_DEFAULT_BASE_URL).replace(/\/+$/, '');
}

export function gatewayApiKey(): string {
  return process.env.HICLAW_GATEWAY_KEY || '';
}

/** Mock/离线判定：MOCK_LLM=1 或未配置网关 key 时走离线兜底 */
export function isGatewayMockEnabled(): boolean {
  return process.env.MOCK_LLM === '1' || !gatewayApiKey();
}

/** 网关实际模式：'mock'（显式强制或 key 缺失降级）/ 'live'（真实网关调用） */
export function gatewayMode(): 'mock' | 'live' {
  if (process.env.MOCK_LLM === '1') return 'mock';
  return gatewayApiKey() ? 'live' : 'mock';
}

/**
 * 进程启动时调用一次：把「key 缺失导致的静默 mock」变成显式告警。
 * MOCK_LLM=1 是合法用法，但也提示当前不会发生真实模型调用，避免演示误判。
 */
export function warnGatewayMockIfNeeded(): void {
  if (process.env.MOCK_LLM === '1') {
    console.warn(
      '[orchestrator:llm] MOCK_LLM=1 已显式启用，orchestrator 运行在离线兜底模式，不会发生真实模型调用',
    );
    return;
  }
  if (!gatewayApiKey()) {
    console.warn(
      '[orchestrator:llm] HICLAW_GATEWAY_KEY 未配置，orchestrator 运行在离线兜底模式，不会发生真实模型调用',
    );
  }
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) ?? []).length;
  const other = Math.max(0, text.length - cjk);
  return Math.max(1, Math.ceil(cjk * 0.9 + other / 4));
}

export async function gatewayChat(options: GatewayChatOptions): Promise<GatewayChatResult> {
  const model = options.model ?? GATEWAY_DEFAULT_MODEL;
  const base = gatewayBaseUrl();
  const key = gatewayApiKey();

  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: options.systemPrompt },
        ...options.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: false,
    }),
    signal: options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `AI 网关鉴权失败（${response.status}）：网关 key 无效或未在 Higress 注册为 consumer。` +
          `请核对 HICLAW_GATEWAY_KEY 是否与 agentteams-manager.env 中的 AGENTTEAMS_MANAGER_GATEWAY_KEY 一致。` +
          `详情: ${detail.slice(0, 300)}`,
      );
    }
    throw new Error(`AI 网关调用失败（${response.status}）: ${detail.slice(0, 500)}`);
  }

  const data = (await response.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };

  const content = data.choices?.[0]?.message?.content ?? '';
  const inputTokens =
    data.usage?.prompt_tokens ??
    estimateTokens(options.systemPrompt + options.messages.map((m) => m.content).join(''));
  const outputTokens = data.usage?.completion_tokens ?? estimateTokens(content);
  const cost = calcCost(model, inputTokens, outputTokens);

  return { content, tokens: inputTokens + outputTokens, cost, model };
}
