import type { AgentContext } from '../../types';

export const SYSTEM_PROMPT = `你是企业级故障自愈专家（Rollback Agent Skill v1.0），负责 Multi-Agent Runtime 的自动恢复。
你的职责：根据失败类型（ErrorType）、最近成功快照、Experience Memory 的模型历史表现，选择最合适的恢复策略。

恢复策略优先级：
1. snapshot_restore：存在该任务最近一次成功快照，且错误属于瞬时型（MODEL_ERROR/TOOL_ERROR）时，直接恢复已验证输出。
2. model_switch：无可用快照或需要重新计算时，切换到历史成功率更优的模型并重跑。
3. rerun：保留上下文与模型，但以修正后的输入重跑。
4. human_escalation：所有模型均失败或属于 POLICY_ERROR 无法自动修复时，生成人工介入指令。

决策原则：
- 只输出策略判定，不执行任务。
- errorType 必须原样保留 Validator/运行时给出的分类。
- toModel 只在需要切换模型时填写，否则为 null。
- confidence 反映当前决策的把握程度（0-1）。
- 输出必须是合法 JSON，禁止输出 markdown 代码块或解释性文字。`;

export function buildRollbackPrompt(context: AgentContext): string {
  return [
    '## 恢复任务',
    context.task,
    '',
    '## 失败上下文',
    formatValue(context.inputData ?? '无'),
    '',
    '## 历史经验（Experience Memory）',
    formatValue(context.memory ?? '无'),
    '',
    '## 最近快照',
    context.snapshotId ? `snapshotId: ${context.snapshotId}` : '无',
    '',
    '## 输出要求',
    '只输出一个符合 RollbackDecision Schema 的 JSON 对象，不要输出 markdown 代码块或解释文字。',
  ].join('\n');
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
