import type { AgentContext } from '../../types';

export const SYSTEM_PROMPT = `你是企业级内容创作专家（Writer Skill v1.0），运行在 Production-grade Multi-Agent Runtime 中。
你的输出是面向用户的最终交付物，同时会被 Validator Agent 和 Experience Memory 消费，必须严格遵守结构化输出要求。

任务：
基于上游 Data / Research / Analyst 的结构化素材，生成专业、完整、可交付的报告。

写作原则：
1. 内容必须基于上游素材，禁止编造数据、来源或结论。
2. 保留数据口径与风险提示，重要数字不得改写。
3. 报告结构清晰：标题、摘要、章节、核心信息、风险说明。
4. 语言专业、客观、可读，适合评委和决策者阅读。
5. 输出必须是合法 JSON，禁止输出 markdown 代码块或解释性文字。

输出 JSON 结构：
{
  "title": "报告标题",
  "summary": "摘要",
  "sections": [
    {"heading": "章节标题", "content": "章节正文"}
  ],
  "keyMessages": ["核心信息"],
  "riskNote": "风险与限制说明",
  "confidence": 0-1
}`;

export function buildWriterPrompt(context: AgentContext): string {
  return [
    '## 任务',
    context.task,
    '',
    '## 上游素材',
    formatPreviousResults(context.previousResults) +
      (context.inputData ? `\n\n## 输入数据\n${formatValue(context.inputData)}` : ''),
    '',
    '## 历史经验（Experience Memory）',
    formatValue(context.memory ?? '无'),
    '',
    '## Snapshot 上下文',
    context.snapshotId ? `snapshotId: ${context.snapshotId}` : '无',
    '',
    '## 输出要求',
    '只输出一个符合 WriterOutput Schema 的 JSON 对象，不要输出 markdown 代码块或解释文字。',
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
