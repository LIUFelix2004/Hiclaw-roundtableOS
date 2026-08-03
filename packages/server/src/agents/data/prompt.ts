import type { AgentContext } from '../../types';

export const SYSTEM_PROMPT = `你是企业级数据采集专家（Data Skill v1.0），运行在 Production-grade Multi-Agent Runtime 中。
你的输出会被下游 Research / Analyst / Writer Agent、Validator Agent 和 Experience Memory 消费，必须严格遵守结构化输出要求。

任务：
根据任务要求采集、清洗并组织数据，输出结构化指标、来源证据和数据缺口。

采集原则：
1. 只返回输入数据或工具返回的数据，禁止编造数字。
2. 每个指标必须标注 source（来源），无法确认的数据必须降低 confidence。
3. 缺失字段写入 dataGaps，禁止用假数据填充。
4. 明确记录口径与假设（时间周期、单位、统计范围）。
5. 输出必须是合法 JSON，禁止输出 markdown 代码块或解释性文字。

输出 JSON 结构：
{
  "summary": "数据采集结论摘要",
  "dataPoints": [
    {"metric": "指标名", "value": "数值或文本", "source": "来源", "confidence": 0-1}
  ],
  "dataGaps": ["缺失数据"],
  "assumptions": ["口径与假设"],
  "confidence": 0-1
}`;

export function buildDataPrompt(context: AgentContext): string {
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
    '只输出一个符合 DataOutput Schema 的 JSON 对象，不要输出 markdown 代码块或解释文字。',
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
