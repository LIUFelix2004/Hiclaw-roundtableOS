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
  data: (task) => `{
  "summary": "主题：${safeTopic(task)} — 已采集 AI 服务器产业链核心数据：出货量、中国市场占比、在手订单与液冷渗透率（Mock 演示数据）。",
  "dataPoints": [
    {"metric": "全球 AI 服务器出货量（2026Q2）", "value": "约 128.6 万台", "source": "演示数据源-01", "confidence": 0.8},
    {"metric": "中国市场占全球出货量", "value": "约 31.4%", "source": "演示数据源-02", "confidence": 0.75},
    {"metric": "头部厂商在手订单环比", "value": "+18.2%", "source": "演示数据源-03", "confidence": 0.7},
    {"metric": "液冷方案渗透率（新建数据中心）", "value": "约 46%", "source": "演示数据源-04", "confidence": 0.7}
  ],
  "dataGaps": ["海外厂商分地区收入明细暂缺", "实时财报口径数据未接入"],
  "assumptions": ["数据为 Mock 演示数据，字段结构与真实数据源一致", "数据周期为 2026-07-27 至 2026-08-02"],
  "confidence": 0.75
}`,
  research: (task) => `{
  "summary": "主题：${safeTopic(task)} — 行业处于高景气阶段：算力需求上行、供应链国产化加速、液冷成为新建项目标配，同时存在出口管制与库存去化风险（Mock 演示数据）。",
  "findings": [
    {"theme": "算力需求延续高景气", "detail": "云厂商资本开支维持双位数增长，推理集群占比快速提升。", "evidence": "演示来源A：行业周报", "confidence": 0.8},
    {"theme": "供应链国产化加速", "detail": "国产 GPU 与高速互联方案进入规模化验证。", "evidence": "演示来源B：公司公告", "confidence": 0.75},
    {"theme": "液冷与高密度成标配", "detail": "单机柜功率密度持续上探，散热方案订单前置。", "evidence": "演示来源C：第三方统计", "confidence": 0.7}
  ],
  "contradictions": ["短期库存去化与中期资本开支扩张并存，口径差异较大"],
  "uncertainties": ["出口管制细则变化方向", "模型训练需求波动幅度"],
  "sources": ["演示来源A", "演示来源B", "演示来源C"],
  "confidence": 0.72
}`,
  analyst: (task) => `{
  "summary": "主题：${safeTopic(task)} — 行业处于需求扩张与供给结构升级阶段，短期波动不改中期上行趋势；建议优先跟踪算力调度、液冷与国产互联三条主线。",
  "keyFindings": [
    {"insight": "全球 AI 服务器出货量延续高景气，环比 +9.6%。", "evidence": "Mock 演示数据源：全球 AI 服务器出货量约 128.6 万台（2026Q2）。", "confidence": 0.85},
    {"insight": "中国市场占全球出货量约 31.4%，头部厂商在手订单环比 +18.2%。", "evidence": "Mock 演示数据源：中国市场占比与在手订单数据。", "confidence": 0.8},
    {"insight": "液冷方案渗透率提升至约 46%，单位机柜价值量上行。", "evidence": "Mock 演示数据源：新建数据中心液冷渗透率。", "confidence": 0.75}
  ],
  "metrics": {"qoq_growth": 0.096, "china_share": 0.314, "liquid_cooling_penetration": 0.46},
  "risks": ["出口管制细则变化可能造成短期供给受限", "库存去化不及预期将压制估值", "模型训练需求波动带来订单节奏不确定"],
  "recommendations": ["优先跟踪算力调度、液冷与国产互联三条主线", "按先验证、再重仓节奏推进", "关注季度订单与资本开支指引兑现度"],
  "assumptions": ["数据为 Mock 演示数据，正式环境将由真实数据源提供", "未纳入实时财报口径与海外分地区收入明细"],
  "confidence": 0.72
}`,
  writer: (task) => `{
  "title": "主题：${safeTopic(task)} — 行业周报（Mock 演示输出）",
  "summary": "本周行业整体保持高景气：AI 服务器出货量环比上升，液冷渗透率提升，国产供应链进入规模化验证阶段；短期需关注出口管制与库存去化带来的波动。",
  "sections": [
    {"heading": "一、市场数据", "content": "全球 AI 服务器出货量约 128.6 万台，环比 +9.6%（演示数据）；中国市场占比约 31.4%，头部厂商在手订单环比 +18.2%。"},
    {"heading": "二、行业动态", "content": "云厂商资本开支维持双位数增长；国产 GPU 与高速互联方案进入规模化验证；高密度机柜成为新建项目标配。"},
    {"heading": "三、分析与展望", "content": "行业处于需求扩张与供给结构升级阶段；中期看好算力调度、液冷与国产互联三条主线，短期需跟踪出口管制与库存节奏。"},
    {"heading": "四、风险提示", "content": "出口管制细则变化、库存去化不及预期、模型训练需求波动。"}
  ],
  "keyMessages": ["高景气延续", "国产替代加速", "液冷价值量提升"],
  "riskNote": "本文件为 Mock 演示输出，正式环境将基于真实数据源与质检结果生成。",
  "confidence": 0.78
}`,
};

function safeTopic(text: string): string {
  const line = text.split('\n').find((l) => l.trim())?.trim() ?? '';
  const topic = line.length > 80 ? `${line.slice(0, 80)}...` : line || '通用任务';
  return JSON.stringify(topic).slice(1, -1);
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
