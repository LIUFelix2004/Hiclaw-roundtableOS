import OpenAI from 'openai';
import type { AgentRole, ErrorType } from '@hermes/shared';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder',
  baseURL: process.env.OPENAI_BASE_URL,
});

export const MODEL_FALLBACKS: Record<AgentRole, string[]> = {
  data: [process.env.MODEL_DATA || 'gpt-4o-mini', 'gpt-3.5-turbo'],
  research: [process.env.MODEL_RESEARCH || 'gpt-4o-mini', 'gpt-3.5-turbo'],
  analyst: [process.env.MODEL_ANALYST || 'gpt-4o', 'gpt-4o-mini'],
  writer: [process.env.MODEL_WRITER || 'gpt-4o', 'gpt-4o-mini'],
  moderator: [process.env.MODEL_MODERATOR || 'gpt-4o', 'gpt-4o-mini'],
  validator: [process.env.MODEL_VALIDATOR || 'gpt-4o-mini', 'gpt-3.5-turbo'],
  rollback: [process.env.MODEL_ROLLBACK || 'gpt-4o-mini', 'gpt-3.5-turbo'],
};

const MODEL_MAP = Object.fromEntries(
  Object.entries(MODEL_FALLBACKS).map(([role, fallbacks]) => [role, fallbacks[0]]),
) as Record<AgentRole, string>;

export function getDefaultModel(role: AgentRole): string {
  return MODEL_FALLBACKS[role]?.[0] ?? 'gpt-4o-mini';
}

export interface ChatOptions {
  role: AgentRole;
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

interface MockDataPoint {
  metric: string;
  value: string;
  source: string;
  confidence: number;
}

interface MockFinding {
  theme: string;
  detail: string;
  evidence: string;
  confidence: number;
}

interface MockAnalystFinding {
  insight: string;
  evidence: string;
  confidence: number;
}

interface MockSection {
  heading: string;
  content: string;
}

interface MockDataset {
  keywords: string[];
  period: string;
  dataSummary: string;
  dataPoints: MockDataPoint[];
  dataGaps: string[];
  researchSummary: string;
  findings: MockFinding[];
  contradictions: string[];
  uncertainties: string[];
  sources: string[];
  analystSummary: string;
  keyFindings: MockAnalystFinding[];
  metrics: Record<string, number>;
  risks: string[];
  recommendations: string[];
  writerTitle: string;
  writerSummary: string;
  sections: MockSection[];
  keyMessages: string[];
  moderatorSummary: string;
  moderatorFinalSolution: string;
  moderatorContributions: Array<{ agent: string; contribution: string }>;
  moderatorTasks: Array<{
    agent: string;
    objective: string;
    input: string;
    expectedOutput: string;
    deadline: string;
  }>;
  moderatorRisks: string[];
  confidence: number;
}

const MOCK_DATASETS: MockDataset[] = [
  {
    keywords: ['新能源', '储能', '光伏', '新能源车', '风电', '锂电'],
    period: '2026-07-27 至 2026-08-02',
    dataSummary: '已采集储能新增装机、光伏新增装机、新能源车渗透率与政策支持数据',
    dataPoints: [
      { metric: '储能新增装机（2026H1）', value: '约 42.6 GWh，同比 +58.3%', source: '演示数据源-01', confidence: 0.82 },
      { metric: '光伏新增装机（2026H1）', value: '约 128 GW，同比 +12.4%', source: '演示数据源-02', confidence: 0.78 },
      { metric: '新能源车零售渗透率（2026年7月）', value: '约 54.7%', source: '演示数据源-03', confidence: 0.8 },
      { metric: '储能系统均价（2026Q2）', value: '约 0.58 元/Wh，环比 -4.1%', source: '演示数据源-04', confidence: 0.75 },
    ],
    dataGaps: ['海外储能分地区装机明细暂缺', '光伏产业链库存口径未统一'],
    researchSummary: '行业呈现“储能高景气、光伏分化、新能源车高位渗透”的结构性特征，机会与风险并存（Mock 演示数据）。',
    findings: [
      { theme: '储能进入市场化收益驱动阶段', detail: '大储与工商业储能双轮驱动，政策强制配储退坡但现货套利与容量补偿改善经济性。', evidence: '演示来源A：行业数据', confidence: 0.8 },
      { theme: '光伏供给出清未完成', detail: '主链价格阶段性企稳，但产能利用率仍偏低，企业盈利分化明显。', evidence: '演示来源B：公司公告', confidence: 0.74 },
      { theme: '新能源车智驾与出口成主线', detail: '零售渗透率突破 50%，智驾平权与海外建厂成为差异化竞争方向。', evidence: '演示来源C：第三方统计', confidence: 0.76 },
    ],
    contradictions: ['储能需求高增与行业产能过剩并存', '光伏装机高增与主链利润承压并存'],
    uncertainties: ['电力现货价格波动幅度', '海外贸易壁垒变化方向'],
    sources: ['演示来源A', '演示来源B', '演示来源C'],
    analystSummary: '建议分阶段配置：优先储能，光伏等待供给出清信号，新能源车关注智驾与出海龙头。',
    keyFindings: [
      { insight: '储能 2026H1 新增装机 42.6GWh，同比 +58.3%，是当前弹性最大的主线。', evidence: 'Mock 演示数据源：储能新增装机与同比数据。', confidence: 0.84 },
      { insight: '光伏 2026H1 新增装机 128GW，同比 +12.4%，但主链盈利仍受供给过剩压制。', evidence: 'Mock 演示数据源：光伏装机与产业链价格数据。', confidence: 0.78 },
      { insight: '新能源车零售渗透率 54.7%，智驾与出口是差异化主线。', evidence: 'Mock 演示数据源：新能源车渗透率数据。', confidence: 0.8 },
    ],
    metrics: { storage_gwh: 42.6, solar_gw: 128, ev_penetration: 0.547, storage_yoy: 0.583 },
    risks: ['储能行业产能过剩与价格战', '光伏供给出清不及预期', '海外政策与贸易壁垒'],
    recommendations: ['第一阶段验证储能订单与政策落地', '第二阶段跟踪光伏供给出清信号', '第三阶段配置新能源车智驾与出海龙头'],
    writerTitle: '新能源行业战略分析周报（Mock 演示输出）',
    writerSummary: '本周新能源行业维持高景气但结构分化：储能新增装机同比 +58.3%，光伏装机同比 +12.4% 但利润承压，新能源车渗透率突破 54.7%；建议分阶段配置，先储能、再光伏、最后新能源车智驾与出海。',
    sections: [
      { heading: '一、市场数据', content: '储能新增装机约 42.6 GWh，同比 +58.3%；光伏新增装机约 128 GW，同比 +12.4%；新能源车零售渗透率约 54.7%；储能系统均价约 0.58 元/Wh（演示数据）。' },
      { heading: '二、行业动态', content: '储能进入市场化收益驱动阶段；光伏主链价格企稳但供给出清未完成；新能源车智驾平权与海外建厂成为差异化主线。' },
      { heading: '三、分析与展望', content: '分阶段配置：优先储能，验证订单与政策落地；光伏等待供给出清信号；新能源车关注智驾与出海龙头。' },
      { heading: '四、风险提示', content: '储能价格战、光伏供给出清不及预期、海外贸易壁垒变化。' },
    ],
    keyMessages: ['储能弹性最大', '光伏等待出清', '智驾出海差异化'],
    moderatorSummary: '圆桌讨论已完成：储能、光伏与新能源车三条主线均已覆盖，分歧集中在“先储能还是先光伏”；结论是分阶段配置：优先储能，光伏等待供给出清信号，新能源车关注智驾与出海龙头（Mock 演示数据）。',
    moderatorFinalSolution: '第一阶段优先布局储能，验证订单与政策落地；第二阶段跟踪光伏供给出清信号并择机加仓；第三阶段配置新能源车智驾与出海龙头。',
    moderatorContributions: [
      { agent: 'data', contribution: '提供储能、光伏与新能源车出货、渗透率与政策数据（Mock）。' },
      { agent: 'research', contribution: '识别储能高景气与光伏供给过剩并存，标注不确定性。' },
      { agent: 'analyst', contribution: '建议分阶段配置，先储能、后光伏、再新能源车，量化风险。' },
      { agent: 'writer', contribution: '输出报告结构与风险提示。' },
    ],
    moderatorTasks: [
      { agent: 'data', objective: '补充储能订单与政策数据', input: '储能产业链', expectedOutput: '结构化数据 JSON', deadline: 'T+1' },
      { agent: 'analyst', objective: '更新分阶段配置建议', input: '储能与光伏最新数据', expectedOutput: '分析洞察 JSON', deadline: 'T+2' },
      { agent: 'writer', objective: '生成最终战略分析报告', input: 'Data/Analyst 输出', expectedOutput: '报告 JSON', deadline: 'T+3' },
    ],
    moderatorRisks: ['储能补贴与电价政策退坡', '光伏供给出清持续', '海外贸易壁垒'],
    confidence: 0.8,
  },
  {
    keywords: ['AI服务器', 'AI 服务器', '算力', '液冷', '服务器', '芯片', '数据中心'],
    period: '2026-07-27 至 2026-08-02',
    dataSummary: '已采集 AI 服务器产业链核心数据：出货量、中国市场占比、在手订单与液冷渗透率',
    dataPoints: [
      { metric: '全球 AI 服务器出货量（2026Q2）', value: '约 128.6 万台', source: '演示数据源-01', confidence: 0.8 },
      { metric: '中国市场占全球出货量', value: '约 31.4%', source: '演示数据源-02', confidence: 0.75 },
      { metric: '头部厂商在手订单环比', value: '+18.2%', source: '演示数据源-03', confidence: 0.7 },
      { metric: '液冷方案渗透率（新建数据中心）', value: '约 46%', source: '演示数据源-04', confidence: 0.7 },
    ],
    dataGaps: ['海外厂商分地区收入明细暂缺', '实时财报口径数据未接入'],
    researchSummary: '行业处于高景气阶段：算力需求上行、供应链国产化加速、液冷成为新建项目标配，同时存在出口管制与库存去化风险（Mock 演示数据）。',
    findings: [
      { theme: '算力需求延续高景气', detail: '云厂商资本开支维持双位数增长，推理集群占比快速提升。', evidence: '演示来源A：行业周报', confidence: 0.8 },
      { theme: '供应链国产化加速', detail: '国产 GPU 与高速互联方案进入规模化验证。', evidence: '演示来源B：公司公告', confidence: 0.75 },
      { theme: '液冷与高密度成标配', detail: '单机柜功率密度持续上探，散热方案订单前置。', evidence: '演示来源C：第三方统计', confidence: 0.7 },
    ],
    contradictions: ['短期库存去化与中期资本开支扩张并存，口径差异较大'],
    uncertainties: ['出口管制细则变化方向', '模型训练需求波动幅度'],
    sources: ['演示来源A', '演示来源B', '演示来源C'],
    analystSummary: '行业处于需求扩张与供给结构升级阶段，短期波动不改中期上行趋势；建议优先跟踪算力调度、液冷与国产互联三条主线。',
    keyFindings: [
      { insight: '全球 AI 服务器出货量延续高景气，环比 +9.6%。', evidence: 'Mock 演示数据源：全球 AI 服务器出货量约 128.6 万台（2026Q2）。', confidence: 0.85 },
      { insight: '中国市场占全球出货量约 31.4%，头部厂商在手订单环比 +18.2%。', evidence: 'Mock 演示数据源：中国市场占比与在手订单数据。', confidence: 0.8 },
      { insight: '液冷方案渗透率提升至约 46%，单位机柜价值量上行。', evidence: 'Mock 演示数据源：新建数据中心液冷渗透率。', confidence: 0.75 },
    ],
    metrics: { qoq_growth: 0.096, china_share: 0.314, liquid_cooling_penetration: 0.46 },
    risks: ['出口管制细则变化可能造成短期供给受限', '库存去化不及预期将压制估值', '模型训练需求波动带来订单节奏不确定'],
    recommendations: ['优先跟踪算力调度、液冷与国产互联三条主线', '按先验证、再重仓节奏推进', '关注季度订单与资本开支指引兑现度'],
    writerTitle: 'AI 服务器产业链行业周报（Mock 演示输出）',
    writerSummary: '本周行业整体保持高景气：AI 服务器出货量环比上升，液冷渗透率提升，国产供应链进入规模化验证阶段；短期需关注出口管制与库存去化带来的波动。',
    sections: [
      { heading: '一、市场数据', content: '全球 AI 服务器出货量约 128.6 万台，环比 +9.6%（演示数据）；中国市场占比约 31.4%，头部厂商在手订单环比 +18.2%。' },
      { heading: '二、行业动态', content: '云厂商资本开支维持双位数增长；国产 GPU 与高速互联方案进入规模化验证；高密度机柜成为新建项目标配。' },
      { heading: '三、分析与展望', content: '行业处于需求扩张与供给结构升级阶段；中期看好算力调度、液冷与国产互联三条主线，短期需跟踪出口管制与库存节奏。' },
      { heading: '四、风险提示', content: '出口管制细则变化、库存去化不及预期、模型训练需求波动。' },
    ],
    keyMessages: ['高景气延续', '国产替代加速', '液冷价值量提升'],
    moderatorSummary: '圆桌讨论已完成：Data 提供结构化数据，Research 识别行业趋势与矛盾，Analyst 给出分阶段配置建议，Writer 输出报告框架；主要分歧已收敛为分阶段执行方案（Mock 演示数据）。',
    moderatorFinalSolution: '优先布局 AI 服务器算力调度与液冷主线，同时保留国产互联跟踪仓位：第一阶段验证订单与资本开支指引，第二阶段根据数据切换加仓方向，并由 Validator 对最终报告执行质检。',
    moderatorContributions: [
      { agent: 'data', contribution: '提供 AI 服务器出货、订单与液冷渗透率数据（Mock）。' },
      { agent: 'research', contribution: '识别算力高景气与库存去化并存，标注不确定性。' },
      { agent: 'analyst', contribution: '建议分阶段配置，先算力调度与液冷，后国产互联，量化风险。' },
      { agent: 'writer', contribution: '输出报告结构与风险提示。' },
    ],
    moderatorTasks: [
      { agent: 'data', objective: '补充头部厂商订单与资本开支数据', input: 'AI 服务器产业链', expectedOutput: '结构化数据 JSON', deadline: 'T+1' },
      { agent: 'analyst', objective: '更新分阶段配置建议', input: '算力调度与液冷最新数据', expectedOutput: '分析洞察 JSON', deadline: 'T+2' },
      { agent: 'writer', objective: '生成最终战略分析报告', input: 'Data/Analyst 输出', expectedOutput: '报告 JSON', deadline: 'T+3' },
    ],
    moderatorRisks: ['出口管制细则变化', '库存去化不及预期', 'Mock 演示数据口径限制'],
    confidence: 0.8,
  },
];

function findDataset(task: string): MockDataset {
  return MOCK_DATASETS.find((d) => d.keywords.some((keyword) => task.includes(keyword))) ?? MOCK_DATASETS[1];
}

const MOCK_TEMPLATES: Record<AgentRole, (task: string) => string> = {
  data: (task) => {
    const d = findDataset(task);
    return JSON.stringify(
      {
        summary: `主题：${safeTopic(task)} — ${d.dataSummary}（Mock 演示数据）。`,
        dataPoints: d.dataPoints,
        dataGaps: d.dataGaps,
        assumptions: ['数据为 Mock 演示数据，字段结构与真实数据源一致', `数据周期：${d.period}`],
        confidence: d.confidence,
      },
      null,
      2,
    );
  },
  research: (task) => {
    const d = findDataset(task);
    return JSON.stringify(
      {
        summary: `主题：${safeTopic(task)} — ${d.researchSummary}`,
        findings: d.findings,
        contradictions: d.contradictions,
        uncertainties: d.uncertainties,
        sources: d.sources,
        confidence: d.confidence,
      },
      null,
      2,
    );
  },
  analyst: (task) => {
    const d = findDataset(task);
    return JSON.stringify(
      {
        summary: `主题：${safeTopic(task)} — ${d.analystSummary}`,
        keyFindings: d.keyFindings,
        metrics: d.metrics,
        risks: d.risks,
        recommendations: d.recommendations,
        assumptions: ['数据为 Mock 演示数据，正式环境将由真实数据源提供', `数据周期：${d.period}`],
        confidence: d.confidence,
      },
      null,
      2,
    );
  },
  writer: (task) => {
    const d = findDataset(task);
    return JSON.stringify(
      {
        title: `主题：${safeTopic(task)} — ${d.writerTitle}`,
        summary: d.writerSummary,
        sections: d.sections,
        keyMessages: d.keyMessages,
        riskNote: '本文件为 Mock 演示输出，正式环境将基于真实数据源与质检结果生成。',
        confidence: d.confidence,
      },
      null,
      2,
    );
  },
  moderator: (task) => {
    const d = findDataset(task);
    return JSON.stringify(
      {
        meetingSummary: `主题：${safeTopic(task)} — ${d.moderatorSummary}`,
        finalSolution: d.moderatorFinalSolution,
        agentContributions: d.moderatorContributions,
        executionTasks: d.moderatorTasks,
        risks: d.moderatorRisks,
        confidence: d.confidence,
      },
      null,
      2,
    );
  },
  validator: (task) => {
    const injected = task.includes('FAIL_INJECT');
    return injected
      ? JSON.stringify(
          {
            pass: false,
            scores: { accuracy: 0.2, completeness: 0.5, safety: 0.7, format: 0.4 },
            failCodes: ['DATA_ERROR', 'MODEL_ERROR'],
            issues: ['注入失败：候选输出包含 FAIL_INJECT 标记，数据真实性存疑', '格式与完整性未达标'],
          },
          null,
          2,
        )
      : JSON.stringify(
          {
            pass: true,
            scores: { accuracy: 0.96, completeness: 0.94, safety: 0.98, format: 0.95 },
            failCodes: [],
            issues: [],
          },
          null,
          2,
        );
  },
  rollback: (task) => {
    const errorType = (task.match(/error_type["':：]*\s*"?([A-Z_]+)"?/i)?.[1] ?? 'MODEL_ERROR') as ErrorType;
    const fromModel = task.match(/from_model["':：]*\s*"?([^",}\s]+)"?/i)?.[1] ?? 'gpt-4o';
    const snapshotAvailable = /snapshot_available["':：]*\s*true/i.test(task);
    const fallbackRaw = task.match(/fallback_models["':：]*\s*\[([^\]]*)\]/i)?.[1] ?? '';
    const fallbackModels = fallbackRaw
      .split(',')
      .map((s) => s.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);

    if (snapshotAvailable) {
      return JSON.stringify(
        {
          strategy: 'snapshot_restore',
          reason: '已存在该任务最近一次成功快照，恢复已验证输出可避免重复计算',
          fromModel,
          toModel: null,
          errorType,
          attempts: 0,
          confidence: 0.92,
          manualInstructions: null,
        },
        null,
        2,
      );
    }
    if (fallbackModels.length > 0) {
      return JSON.stringify(
        {
          strategy: 'model_switch',
          reason: `切换到历史成功率更优的模型 ${fallbackModels[0]} 并重跑`,
          fromModel,
          toModel: fallbackModels[0],
          errorType,
          attempts: 1,
          confidence: 0.78,
          manualInstructions: null,
        },
        null,
        2,
      );
    }
    return JSON.stringify(
      {
        strategy: 'human_escalation',
        reason: '可用模型均已尝试，仍无法恢复，需人工介入',
        fromModel,
        toModel: null,
        errorType,
        attempts: fallbackModels.length,
        confidence: 0.5,
        manualInstructions: '请人工检查失败原因与任务输入，修复后重试',
      },
      null,
      2,
    );
  },
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
  const model = options.model ?? MODEL_MAP[options.role] ?? 'gpt-4o-mini';
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
  const model = options.model ?? MODEL_MAP[options.role] ?? 'gpt-4o-mini';

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
