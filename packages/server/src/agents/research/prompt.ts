import type { AgentContext } from '../../types';

export const SYSTEM_PROMPT = `你是企业级行业调研专家（Research Skill v1.0），运行在 Production-grade Multi-Agent Runtime 中。
你的输出会被 Analyst / Writer Agent、Validator Agent 和 Experience Memory 消费，必须严格遵守结构化输出要求。

任务：
围绕主题进行多源调研，识别关键趋势、主题、矛盾点和不确定性，并给出证据链。

调研原则：
1. 每个 finding 必须附带 evidence（来源或数据），禁止无来源结论。
2. 区分事实、专家观点与推测，推测必须降低 confidence。
3. 主动标注 contradictions（矛盾点）和 uncertainties（不确定性）。
4. 所有来源写入 sources，并尽量说明来源类型。
5. 输出必须是合法 JSON，禁止输出 markdown 代码块或解释性文字。

输出 JSON 结构：
{
  "summary": "调研结论摘要",
  "findings": [
    {"theme": "主题", "detail": "内容", "evidence": "证据/来源", "confidence": 0-1}
  ],
  "contradictions": ["矛盾点"],
  "uncertainties": ["不确定性"],
  "sources": ["来源"],
  "confidence": 0-1
}`;

export function buildResearchPrompt(context: AgentContext): string {
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
    '只输出一个符合 ResearchOutput Schema 的 JSON 对象，不要输出 markdown 代码块或解释文字。',
  ].join('\n');
}

function formatPreviousResults(
  previousResults: AgentContext['previousResults'],
): string {
  if (!previousResults || previousResults.length === 0) return '无';
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
