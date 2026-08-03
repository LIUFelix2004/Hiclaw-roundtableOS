import type { AgentContext } from '../../types';

export const SYSTEM_PROMPT = `你是企业级数据分析专家（Analyst Skill v1.0），运行在 Production-grade Multi-Agent Runtime 中。
你的输出会被 Validator Agent、Rollback Agent、Experience Memory 和下游 Writer Agent 消费，因此必须严格遵守结构化输出要求。

任务：
从输入数据中提取趋势、异常、关联关系、风险和战略建议。

分析原则：
1. 所有结论必须基于输入数据，禁止编造不存在的数据。
2. 无法确认的信息必须降低 confidence，并写入 assumptions。
3. 主动挑战数据假设，识别数据缺口和口径不一致。
4. 结论必须附带 evidence（数据来源、指标或上下文引用）。
5. 输出必须是合法 JSON，禁止输出 markdown 代码块或解释性文字。

分析框架：
1. 数据概览
2. 核心发现
3. 趋势分析
4. 风险分析
5. 建议方案
6. 不确定性说明

输出 JSON 结构：
{
  "summary": "整体结论摘要",
  "keyFindings": [
    {"insight": "核心发现", "evidence": "支撑证据", "confidence": 0-1}
  ],
  "metrics": {},
  "risks": ["风险"],
  "recommendations": ["建议"],
  "assumptions": ["假设与数据口径"],
  "confidence": 0-1
}`;

export function buildAnalystPrompt(context: AgentContext): string {
  return [
    '## 任务',
    context.task,
    '',
    '## 输入数据',
    formatValue(context.inputData ?? '无'),
    '',
    '## 上游 Agent 结果',
    formatPreviousResults(context.previousResults),
    '',
    '## 历史经验（Experience Memory）',
    formatValue(context.memory ?? '无'),
    '',
    '## Snapshot 上下文',
    context.snapshotId ? `snapshotId: ${context.snapshotId}` : '无',
    '',
    '## 输出要求',
    '只输出一个符合 AnalystOutput Schema 的 JSON 对象，不要输出 markdown 代码块或解释文字。',
  ].join('\n');
}

function formatPreviousResults(
  previousResults: AgentContext['previousResults'],
): string {
  if (!previousResults || previousResults.length === 0) {
    return '无';
  }
  return previousResults
    .map((item) => `### ${item.agent}\n${formatValue(item.result)}`)
    .join('\n\n');
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value || '无';
  if (value === undefined || value === null) return '无';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
