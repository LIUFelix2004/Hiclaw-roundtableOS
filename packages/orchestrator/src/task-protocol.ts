import type { AgentRole } from '@hermes/shared';

/**
 * Worker 任务协议（T3.3）。
 *
 * 定义编排层（orchestrator）发给 hiclaw Worker 的「任务正文」模板，
 * 以及 Worker 返回的结构化结果契约（content + usage）。
 * 对应文档：deploy/task-protocol.md。
 */

export interface TaskProtocolInput {
  taskId: string;
  role: AgentRole;
  title: string;
  userMessage: string;
  upstreamOutputs: Array<{ agent: AgentRole; title: string; output: string }>;
  /** T5：可选模型偏好（Rollback model_switch 时注入，Worker 端可识别则遵守） */
  modelHint?: string;
}

export interface WorkerUsage {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface WorkerStructuredResult {
  content: string;
  usage: WorkerUsage;
  /** Worker 回传的任务 ID（用于回复精确匹配，缺失时保持 undefined） */
  taskId?: string;
}

const ROLE_LABELS: Record<string, string> = {
  data: '数据采集（data）',
  research: '研究检索（research）',
  analyst: '分析洞察（analyst）',
  writer: '报告撰写（writer）',
  moderator: '圆桌主持（moderator）',
  validator: '质检（validator）',
  rollback: '恢复（rollback）',
};

/**
 * 构造发给 Worker 的任务正文。
 * 含任务标识、角色说明、用户原始请求、上游输出注入与输出契约。
 */
export function buildTaskBody(input: TaskProtocolInput): string {
  const roleLabel = ROLE_LABELS[input.role] ?? input.role;
  const lines: string[] = [];

  lines.push('[HERMES TASK]');
  lines.push(`taskId: ${input.taskId}`);
  lines.push(`role: ${input.role}`);
  lines.push(`title: ${input.title}`);
  if (input.modelHint) {
    lines.push(`model: ${input.modelHint}`);
  }
  lines.push('');

  lines.push('<用户请求>');
  lines.push(input.userMessage);
  lines.push('</用户请求>');
  lines.push('');

  if (input.upstreamOutputs.length > 0) {
    lines.push('<上游输出>');
    for (const up of input.upstreamOutputs) {
      lines.push(`[${up.agent}] ${up.title}`);
      lines.push(up.output);
      lines.push('');
    }
    lines.push('</上游输出>');
    lines.push('');
  }

  lines.push(`<你的角色>${roleLabel}。基于用户请求${input.upstreamOutputs.length > 0 ? '与上游输出' : ''}完成你的产出。</你的角色>`);
  lines.push('');

  lines.push('<输出契约>');
  lines.push('你必须只输出一个 JSON 对象（不要包裹 Markdown 代码块、不要输出任何额外文字），结构如下：');
  lines.push('{');
  lines.push('  "taskId": "原样回传收到的 taskId（见正文开头）",');
  lines.push('  "content": "你的最终产出（字符串，可为结构化 JSON 的字符串表示）",');
  lines.push('  "usage": { "model": "模型名", "inputTokens": 数字, "outputTokens": 数字 }');
  lines.push('}');
  lines.push('其中 usage 为可选字段，无法统计时可省略；taskId 与 content 为必填。');
  lines.push('</输出契约>');

  return lines.join('\n');
}

/** 从可能包裹代码块/杂音的文本中提取首个 JSON 对象 */
function extractJson(raw: string): Record<string, unknown> | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? raw;
  // 优先尝试整段解析
  try {
    const v = JSON.parse(candidate.trim());
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    // 退化为首个平衡花括号片段
    const start = candidate.indexOf('{');
    if (start < 0) return null;
    const end = candidate.lastIndexOf('}');
    if (end <= start) return null;
    try {
      const v = JSON.parse(candidate.slice(start, end + 1));
      return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
}

/**
 * 解析 Worker 返回：优先结构化 JSON（content + usage），
 * 解析失败时回退为原始文本（content = raw，usage 为空）。
 */
export function parseWorkerResult(raw: string): WorkerStructuredResult {
  const json = extractJson(raw);
  if (json && typeof json.content === 'string') {
    const u = (json.usage ?? {}) as Record<string, unknown>;
    return {
      content: json.content,
      usage: {
        model: typeof u.model === 'string' ? u.model : undefined,
        inputTokens: typeof u.inputTokens === 'number' ? u.inputTokens : undefined,
        outputTokens: typeof u.outputTokens === 'number' ? u.outputTokens : undefined,
      },
      taskId: typeof json.taskId === 'string' ? json.taskId : undefined,
    };
  }
  return { content: raw, usage: {} };
}
