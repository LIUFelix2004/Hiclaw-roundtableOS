import type {
  AgentRole,
  ErrorType,
  RollbackStrategy,
  RollbackResult,
  RollbackHumanEscalation,
} from '@hermes/shared';
import { gatewayChat, isGatewayMockEnabled } from './llm';
import type { SharedEmit } from './event-mapping';
import { experienceMemory } from './experience-memory';

/**
 * Rollback 恢复链（T5）：执行失败或质检不过时自动恢复。
 *
 * 与 server 层 RollbackEngine 的差异：编排层没有本地 snapshot-store，
 * 因此不支持 snapshot_restore，恢复顺序收敛为：
 *   model_switch / rerun → human_escalation
 * 决策用本地网关 LLM（gatewayChat），离线兜底走确定性策略。
 */

const ROLLBACK_SYSTEM_PROMPT = `你是 Multi-Agent Runtime 的 Rollback 决策专家。
根据失败任务信息，从以下策略中选择最合适的恢复方式：
1. model_switch：切换到备选模型重跑（适用于模型质量/格式/政策类问题）
2. rerun：用当前模型重试（适用于瞬时错误）
3. human_escalation：人工介入（所有候选均失败时）

只输出一个 JSON 对象，结构：
{
  "strategy": "model_switch" | "rerun" | "human_escalation",
  "reason": "决策理由",
  "toModel": "建议切换到的模型名或 null",
  "attempts": 建议重试次数,
  "confidence": 0-1,
  "manualInstructions": "人工介入时的操作指引或 null"
}
不要输出 markdown 代码块或解释文字。`;

interface RollbackDecision {
  strategy: RollbackStrategy;
  reason: string;
  toModel: string | null;
  attempts: number;
  confidence: number;
  manualInstructions?: string | null;
}

export interface RecoveryOptions {
  taskId: string;
  taskTitle: string;
  role: AgentRole;
  errorType: ErrorType;
  fromModel: string;
  failureMessage?: string;
  /** 由 scheduler 注入：用指定模型（或默认）重新派发任务并解析结果 */
  rerun: (modelHint?: string) => Promise<{ output: string; model: string }>;
  emit: SharedEmit;
  log: (message: string) => void;
}

export interface RecoveryOutcome {
  recovered: boolean;
  output?: string;
  model?: string;
  strategy: RollbackStrategy;
  toModel: string;
  attempts: number;
  reason: string;
}

async function decide(
  options: RecoveryOptions,
  fallbackModels: string[],
): Promise<RollbackDecision | undefined> {
  if (isGatewayMockEnabled()) return undefined;

  const recoveryInput = JSON.stringify(
    {
      taskId: options.taskId,
      role: options.role,
      error_type: options.errorType,
      from_model: options.fromModel,
      fallback_models: fallbackModels,
      failure_message: options.failureMessage ?? '',
    },
    null,
    2,
  );

  try {
    const result = await gatewayChat({
      systemPrompt: ROLLBACK_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: recoveryInput }],
      temperature: 0.2,
      maxTokens: 1024,
    });
    return JSON.parse(result.content) as RollbackDecision;
  } catch (err: any) {
    options.log(`[rollback] 决策失败，使用确定性兜底: ${err?.message ?? err}`);
    return undefined;
  }
}

function emitComplete(
  emit: SharedEmit,
  r: {
    taskId: string;
    role: AgentRole;
    errorType: ErrorType;
    fromModel: string;
    toModel: string;
    strategy: RollbackStrategy;
    recovered: boolean;
    attempts: number;
    reason: string;
    startTime: number;
  },
): void {
  const record: RollbackResult = {
    taskId: r.taskId,
    agent: r.role,
    errorType: r.errorType,
    fromModel: r.fromModel,
    toModel: r.toModel,
    strategy: r.strategy,
    recovered: r.recovered,
    attempts: r.attempts,
    reason: r.reason,
    duration: Date.now() - r.startTime,
  };
  emit('rollback:complete', { ...record });
}

export async function recoverTask(options: RecoveryOptions): Promise<RecoveryOutcome> {
  const { taskId, taskTitle, role, errorType, fromModel, failureMessage, rerun, emit, log } =
    options;
  const startTime = Date.now();
  const fallbackModels = experienceMemory.pickFallback(role, fromModel);
  const decision = await decide(options, fallbackModels);

  // 编排层无 snapshot_restore：归一化到 model_switch / rerun / human_escalation
  let strategy: RollbackStrategy =
    decision?.strategy === 'snapshot_restore'
      ? fallbackModels.length > 0
        ? 'model_switch'
        : 'human_escalation'
      : decision?.strategy ??
        (fallbackModels.length > 0 ? 'model_switch' : 'human_escalation');

  const models =
    strategy === 'rerun' && fallbackModels.length === 0 ? [fromModel] : fallbackModels;
  if (models.length === 0) strategy = 'human_escalation';

  if (strategy === 'model_switch' || strategy === 'rerun') {
    for (let index = 0; index < models.length; index++) {
      const toModel = models[index];
      emit('rollback:start', { taskId, errorType, fromModel, toModel });
      try {
        const result = await rerun(toModel);
        const reason = decision?.reason ?? `模型切换至 ${toModel} 后重跑成功`;
        emitComplete(emit, {
          taskId,
          role,
          errorType,
          fromModel,
          toModel,
          strategy,
          recovered: true,
          attempts: index + 1,
          reason,
          startTime,
        });
        await experienceMemory.record({
          taskType: taskTitle,
          agent: role,
          model: result.model || toModel,
          success: true,
        });
        return {
          recovered: true,
          output: result.output,
          model: result.model || toModel,
          strategy,
          toModel,
          attempts: index + 1,
          reason,
        };
      } catch (err: any) {
        log(`[rollback] ${role} ${toModel} 重跑失败: ${err?.message ?? err}`);
        await experienceMemory.record({
          taskType: taskTitle,
          agent: role,
          model: toModel,
          success: false,
          failReason: err?.message ?? String(err),
        });
      }
    }
  }

  // 人工升级
  const reason =
    decision?.reason ?? `所有可用模型（${fallbackModels.join(', ') || '无'}）均无法恢复`;
  const escalation: RollbackHumanEscalation = {
    taskId,
    agent: role,
    errorType,
    message: `Rollback 无法自动恢复 ${role} 任务：${reason}`,
    instructions:
      decision?.manualInstructions ??
      '请人工检查失败原因与任务输入，修复后重试；必要时调整模型配置或数据源。',
  };
  emit('rollback:human', { ...escalation });
  emitComplete(emit, {
    taskId,
    role,
    errorType,
    fromModel,
    toModel: 'manual',
    strategy: 'human_escalation',
    recovered: false,
    attempts: models.length,
    reason,
    startTime,
  });
  await experienceMemory.record({
    taskType: taskTitle,
    agent: role,
    model: fromModel,
    success: false,
    failReason: reason,
  });
  return {
    recovered: false,
    strategy: 'human_escalation',
    toModel: 'manual',
    attempts: models.length,
    reason,
  };
}
