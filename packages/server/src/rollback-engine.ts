import type {
  AgentRole,
  ErrorType,
  RollbackHumanEscalation,
  RollbackResult,
  RollbackStrategy,
} from '@hermes/shared';
import type { AgentResult, ExecutionContext } from './types';
import type { BaseAgent } from './agents/base';
import type { SkillAgent } from './agents/skill-agent';
import { RollbackAgent } from './agents/rollback';
import type { RollbackDecision } from './agents/rollback/schema';
import { experienceMemory } from './experience-memory';
import { snapshotStore } from './snapshot-store';

export interface RecoveryOptions {
  taskId: string;
  taskTitle: string;
  role: AgentRole;
  errorType: ErrorType;
  fromModel: string;
  input: string;
  context: string;
  agent: BaseAgent;
  ctx: ExecutionContext;
  failureMessage?: string;
}

export interface RecoveryOutcome {
  recovered: boolean;
  result?: AgentResult;
  decision?: RollbackDecision;
  strategy: RollbackStrategy;
  toModel: string;
  attempts: number;
  reason: string;
}

/**
 * Rollback Engine: executes the strategy decided by the Rollback Agent Skill.
 *
 * Recovery order:
 * 1. snapshot_restore — reuse the last validated output for transient errors.
 * 2. model_switch / rerun — rerun the same task with a fallback model ordered
 *    by Experience Memory success rate.
 * 3. human_escalation — emit an actionable ticket when all candidates fail.
 */
export class RollbackEngine {
  private rollbackAgent = new RollbackAgent();

  async recoverAgent(options: RecoveryOptions): Promise<RecoveryOutcome> {
    return this.recover(options);
  }

  async recoverValidation(options: RecoveryOptions): Promise<RecoveryOutcome> {
    return this.recover(options);
  }

  private async recover(options: RecoveryOptions): Promise<RecoveryOutcome> {
    const startTime = Date.now();
    const fallbackModels = experienceMemory.pickFallback(options.role, options.fromModel);
    const snapshot = snapshotStore.latestSuccess(options.taskId, options.role);
    const decision = await this.decide(options, fallbackModels, !!snapshot);
    const hasTransientError =
      options.errorType === 'MODEL_ERROR' || options.errorType === 'TOOL_ERROR';
    const useSnapshot =
      !!snapshot &&
      (decision?.strategy === 'snapshot_restore' ||
        (!decision && hasTransientError));
    let strategy: RollbackStrategy =
      decision?.strategy ??
      (useSnapshot
        ? 'snapshot_restore'
        : fallbackModels.length > 0
          ? 'model_switch'
          : 'human_escalation');
    if (strategy === 'snapshot_restore' && !useSnapshot) {
      strategy = fallbackModels.length > 0 ? 'model_switch' : 'human_escalation';
    }

    if (useSnapshot && snapshot?.output !== undefined) {
      const result: AgentResult = {
        taskId: options.taskId,
        role: options.role,
        output:
          typeof snapshot.output === 'string'
            ? snapshot.output
            : JSON.stringify(snapshot.output),
        tokens: 0,
        cost: 0,
        duration: 0,
        model: `snapshot:${snapshot.model}`,
      };
      const reason = decision?.reason ?? '最近一次成功快照已恢复';
      this.emitStart(options, 'snapshot');
      this.emitComplete(options, 'snapshot', 'snapshot_restore', true, 0, reason, startTime);
      return {
        recovered: true,
        result,
        decision,
        strategy: 'snapshot_restore',
        toModel: 'snapshot',
        attempts: 0,
        reason,
      };
    }

    if (strategy === 'model_switch' || strategy === 'rerun') {
      const models =
        strategy === 'rerun' && fallbackModels.length === 0
          ? [options.fromModel]
          : fallbackModels;
      for (let index = 0; index < models.length; index++) {
        const toModel = models[index];
        this.emitStart(options, toModel);
        try {
          const result = await (options.agent as SkillAgent<any>).execute(
            options.taskId,
            options.taskTitle,
            options.input,
            options.context,
            options.ctx,
            toModel,
          );
          const reason = decision?.reason ?? `模型切换至 ${toModel} 后重跑成功`;
          this.emitComplete(
            options,
            toModel,
            'model_switch',
            true,
            index + 1,
            reason,
            startTime,
          );
          return {
            recovered: true,
            result,
            decision,
            strategy: 'model_switch',
            toModel,
            attempts: index + 1,
            reason,
          };
        } catch (err: any) {
          console.warn(
            `[rollback] ${options.role} ${toModel} 重跑失败: ${err?.message ?? err}`,
          );
        }
      }
    }

    const attempts = strategy === 'human_escalation' ? 0 : fallbackModels.length;
    const reason =
      decision?.reason ??
      `所有可用模型（${fallbackModels.join(', ') || '无'}）均无法恢复`;
    const escalation: RollbackHumanEscalation = {
      taskId: options.taskId,
      agent: options.role,
      errorType: options.errorType,
      message: `Rollback 无法自动恢复 ${options.role} 任务：${reason}`,
      instructions:
        decision?.manualInstructions ??
        '请人工检查失败原因与任务输入，修复后重试；必要时调整模型配置或数据源。',
    };
    options.ctx.emit('rollback:human', escalation);
    this.emitComplete(
      options,
      'manual',
      'human_escalation',
      false,
      attempts,
      reason,
      startTime,
    );
    return {
      recovered: false,
      decision,
      strategy: 'human_escalation',
      toModel: 'manual',
      attempts,
      reason,
    };
  }

  private async decide(
    options: RecoveryOptions,
    fallbackModels: string[],
    snapshotAvailable: boolean,
  ): Promise<RollbackDecision | undefined> {
    const recoveryInput = JSON.stringify(
      {
        taskId: options.taskId,
        role: options.role,
        error_type: options.errorType,
        from_model: options.fromModel,
        snapshot_available: snapshotAvailable,
        fallback_models: fallbackModels,
        failure_message: options.failureMessage ?? '',
      },
      null,
      2,
    );
    const task = `恢复任务 ${options.taskId}（${options.role}）失败 [${options.errorType}]`;
    try {
      const result = await this.rollbackAgent.execute(
        `rb_${options.taskId}`,
        'Rollback Decision',
        task,
        recoveryInput,
        options.ctx,
      );
      const decision = JSON.parse(result.output) as RollbackDecision;
      return { ...decision, fromModel: options.fromModel };
    } catch (err: any) {
      console.warn(`[rollback] 决策失败，使用确定性兜底: ${err?.message ?? err}`);
      return undefined;
    }
  }

  private emitStart(options: RecoveryOptions, toModel: string): void {
    options.ctx.emit('rollback:start', {
      taskId: options.taskId,
      errorType: options.errorType,
      fromModel: options.fromModel,
      toModel,
    });
  }

  private emitComplete(
    options: RecoveryOptions,
    toModel: string,
    strategy: RollbackStrategy,
    recovered: boolean,
    attempts: number,
    reason: string,
    startTime: number,
  ): void {
    const record: RollbackResult = {
      taskId: options.taskId,
      agent: options.role,
      errorType: options.errorType,
      fromModel: options.fromModel,
      toModel,
      strategy,
      recovered,
      attempts,
      reason,
      duration: Date.now() - startTime,
    };
    options.ctx.emit('rollback:complete', record);
  }
}
