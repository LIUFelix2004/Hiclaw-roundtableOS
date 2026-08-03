import OpenAI from 'openai';
import type { AgentRole } from '@hermes/shared';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder',
  baseURL: process.env.OPENAI_BASE_URL,
});

const MODEL_MAP: Record<AgentRole, string> = {
  data: process.env.MODEL_DATA || 'gpt-4o-mini',
  research: process.env.MODEL_RESEARCH || 'gpt-4o-mini',
  analyst: process.env.MODEL_ANALYST || 'gpt-4o',
  writer: process.env.MODEL_WRITER || 'gpt-4o',
};

export interface ChatOptions {
  role: AgentRole;
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
}

const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
};

function calcCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model] ?? { input: 1, output: 3 };
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

/**
 * Mock mode: MOCK_LLM=1 forces built-in demo data.
 * If no OPENAI_API_KEY is configured, mock mode is enabled automatically
 * so the demo can run offline without any model gateway.
 */
export function isMockEnabled(): boolean {
  return process.env.MOCK_LLM === '1' || !process.env.OPENAI_API_KEY;
}

const MOCK_TEMPLATES: Record<AgentRole, (task: string) => string> = {
  data: (task) => `## 数据采集结果（Mock 演示数据）

主题：${firstLine(task)}

| 指标 | 数值 | 来源 |
| --- | --- | --- |
| 全球 AI 服务器出货量（2026Q2） | 约 128.6 万台 | 演示数据源-01 |
| 中国市场占全球出货量 | 约 31.4% | 演示数据源-02 |
| 头部厂商在手订单环比 | +18.2% | 演示数据源-03 |
| 液冷方案渗透率（新建数据中心） | 约 46% | 演示数据源-04 |

补充说明：
- 数据来自 Mock 演示库，字段结构与真实数据源保持一致。
- 缺失字段标记为 null，不做编造填充。
- 数据周期：2026-07-27 至 2026-08-02。
- 数据缺口：海外厂商分地区收入明细暂缺，建议接入财报 API 补全。`,
  research: (task) => `## 行业研究摘要（Mock 演示数据）

主题：${firstLine(task)}

1. 算力需求延续高景气：云厂商资本开支维持双位数增长，推理集群占比快速提升。
2. 供应链国产化加速：国产 GPU 与高速互联方案进入规模化验证，生态成熟度提升。
3. 液冷与高密度成为新建项目标配：单机柜功率密度持续上探，散热方案订单前置。
4. 风险信号：出口管制细则变化与库存去化节奏仍存在不确定性。

证据与来源：来源A（行业周报）、来源B（公司公告）、来源C（第三方统计）。
注意：以上内容为 Mock 演示材料，正式环境将由 MCP/RAG 工具提供真实证据。`,
  analyst: (task) => `## 分析洞察（Mock 演示数据）

主题：${firstLine(task)}

关键判断：行业处于“需求扩张 + 供给结构升级”阶段，短期波动不改中期上行趋势。

支撑数据：
- 出货量环比约 +9.6%，头部厂商订单能见度约 2 个季度。
- 液冷渗透率提升带动单机柜价值量上行。
- 国产替代链进入规模验证窗口，供给弹性逐步释放。

风险提示：出口管制收紧将造成短期供给受限；库存去化不及预期将压制估值。
行动建议：优先跟踪算力调度、液冷与国产互联三条主线，关注季度订单与资本开支指引兑现度。

注：以上为演示分析，不构成投资建议。`,
  writer: (task) => `# 行业周报（Mock 演示输出）

主题：${firstLine(task)}

## 摘要
本周行业整体保持高景气：AI 服务器出货量环比上升，液冷渗透率提升，国产供应链进入规模化验证阶段；短期需关注出口管制与库存去化带来的波动。

## 一、市场数据
- 全球 AI 服务器出货量约 128.6 万台，环比 +9.6%（演示数据）。
- 中国市场占比约 31.4%，头部厂商在手订单环比 +18.2%。
- 液冷方案渗透率约 46%，新建数据中心成为主要增量来源。

## 二、行业动态
- 云厂商资本开支维持双位数增长，推理集群占比快速提升。
- 国产 GPU 与高速互联方案进入规模化验证。
- 高密度机柜成为新建项目标配，散热方案订单前置。

## 三、分析与展望
行业处于“需求扩张 + 供给结构升级”阶段；中期看好算力调度、液冷与国产互联三条主线，短期需跟踪出口管制与库存节奏。

## 风险提示
出口管制细则变化、库存去化不及预期、模型训练需求波动。

结论：整体判断偏积极，建议按“先验证、再重仓”节奏推进。

> 本文件为 Mock 演示输出，正式环境将基于真实数据源与质检结果生成。`,
};

function firstLine(text: string): string {
  const line = text.split('\n').find((l) => l.trim())?.trim() ?? '';
  return line.length > 80 ? `${line.slice(0, 80)}...` : line || '通用任务';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mockChat(options: ChatOptions): Promise<ChatResult> {
  const model = MODEL_MAP[options.role] || 'gpt-4o-mini';
  const task = options.messages.map((m) => m.content).join('\n');
  const content = MOCK_TEMPLATES[options.role](task);

  // Simulate streaming so the canvas shows the same UX as real model calls.
  const chunkSize = 6;
  for (let i = 0; i < content.length; i += chunkSize) {
    options.onChunk?.(content.slice(i, i + chunkSize));
    await sleep(8);
  }

  const inputTokens = Math.ceil(task.length / 4);
  const outputTokens = Math.ceil(content.length / 4);
  const cost = calcCost(model, inputTokens, outputTokens);

  return { content, tokens: inputTokens + outputTokens, cost, model };
}

export async function chat(options: ChatOptions): Promise<ChatResult> {
  const model = MODEL_MAP[options.role] || 'gpt-4o-mini';

  if (isMockEnabled()) {
    return mockChat(options);
  }

  const stream = await openai.chat.completions.create(
    {
      model,
      messages: [
        { role: 'system', content: options.systemPrompt },
        ...options.messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: true,
    },
    { signal: options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined },
  );

  let content = '';
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      content += delta;
      options.onChunk?.(delta);
    }
  }

  // Estimate tokens (rough heuristic: ~4 chars per token)
  const inputChars = options.systemPrompt.length + options.messages.reduce((s, m) => s + m.content.length, 0);
  const inputTokens = Math.ceil(inputChars / 4);
  const outputTokens = Math.ceil(content.length / 4);
  const cost = calcCost(model, inputTokens, outputTokens);

  return { content, tokens: inputTokens + outputTokens, cost, model };
}
