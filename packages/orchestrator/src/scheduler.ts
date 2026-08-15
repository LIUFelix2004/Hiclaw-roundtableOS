import type { SubTask, AgentRole } from '@hermes/shared';
import { buildTaskBody, parseWorkerResult } from './task-protocol';
import type { SharedEmit } from './event-mapping';
import { validateOutput } from './validator';
import { recoverTask } from './rollback';
import { experienceMemory } from './experience-memory';

/**
 * TaskScheduler（T3.2）：从 legacy packages/server/src/scheduler.ts 迁入。
 *
 * 保留 Kahn 拓扑分层并行；唯一差异是执行单元从本地 agent.execute 换成
 * Worker 远程调用（WorkerDispatcher.dispatch），上游输出通过任务正文模板
 * 注入（buildTaskBody）。validator / rollback 恢复链属 T5，不在本阶段迁入。
 */

/** Worker 远程派发抽象：编排层（Orchestrator）实现此接口 */
export interface WorkerDispatcher {
  dispatch(role: AgentRole, taskId: string, body: string, timeoutMs?: number): Promise<string>;
}

export interface SchedulerOptions {
  dispatcher: WorkerDispatcher;
  emit?: SharedEmit;
  log?: (message: string) => void;
  /** Worker 回报 usage 缺省时的兜底模型名，默认 deepseek-v4-pro */
  defaultModel?: string;
}

export interface ScheduledResult {
  taskId: string;
  role: AgentRole;
  output: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  duration: number;
}

export class TaskScheduler {
  private readonly dispatcher: WorkerDispatcher;
  private readonly emit: SharedEmit;
  private readonly log: (message: string) => void;
  private readonly defaultModel: string;

  constructor(opts: SchedulerOptions) {
    this.dispatcher = opts.dispatcher;
    this.emit = opts.emit ?? (() => {});
    this.log = opts.log ?? (() => {});
    this.defaultModel = opts.defaultModel ?? 'deepseek-v4-pro';
  }

  /**
   * 按 DAG 依赖执行全部子任务，返回按执行完成顺序排列的结果
   * （不保证 DAG 顺序——相互独立的任务可能并行完成）。
   */
  async execute(tasks: SubTask[], userMessage: string): Promise<ScheduledResult[]> {
    if (tasks.length === 0) return [];

    const results: ScheduledResult[] = [];
    const completed = new Map<string, string>(); // taskId → output
    const remaining = new Map(tasks.map((t) => [t.id, t]));

    let round = 0;
    const maxRounds = tasks.length * 2; // 安全阀
    while (remaining.size > 0 && round < maxRounds) {
      round++;

      // 找出依赖均已完成的就绪任务
      const ready: SubTask[] = [];
      for (const [, task] of remaining) {
        if (task.dependsOn.every((depId) => completed.has(depId))) {
          ready.push(task);
        }
      }

      if (ready.length === 0) {
        this.emit('error', {
          message: `Scheduler: deadlock detected at round ${round}. Remaining: ${remaining.size} tasks.`,
        });
        break;
      }

      // 同一层级的就绪任务并行执行
      const batch = await Promise.all(
        ready.map((task) => this.runTask(task, userMessage, completed, tasks)),
      );

      for (const r of batch) {
        completed.set(r.taskId, r.output);
        results.push(r);
      }
      for (const task of ready) remaining.delete(task.id);
    }

    return results;
  }

  private async runTask(
    task: SubTask,
    userMessage: string,
    completed: Map<string, string>,
    tasks: SubTask[],
  ): Promise<ScheduledResult> {
    const fallbackModel = this.defaultModel;
    this.emit('agent:status', {
      taskId: task.id,
      agent: task.agent,
      status: 'running',
      progress: 0,
      model: fallbackModel,
    });

    // 上游输出（buildBody 与质检共用）
    const upstreamOutputsOf = () =>
      task.dependsOn.map((depId) => {
        const depTask = tasks.find((t) => t.id === depId);
        return {
          agent: depTask?.agent ?? task.agent,
          title: depTask?.title ?? depId,
          output: completed.get(depId) ?? '',
        };
      });

    // 任务正文（T5：modelHint 供 Rollback model_switch 注入模型偏好）
    const buildBody = (modelHint?: string): string =>
      buildTaskBody({
        taskId: task.id,
        role: task.agent,
        title: task.title,
        userMessage,
        upstreamOutputs: upstreamOutputsOf(),
        modelHint,
      });

    // Rollback 重跑闭包：用指定模型（或默认）重新派发并解析
    const rerun = async (modelHint?: string) => {
      const raw = await this.dispatcher.dispatch(task.agent, task.id, buildBody(modelHint));
      const parsed = parseWorkerResult(raw);
      return { output: parsed.content, model: parsed.usage.model ?? modelHint ?? fallbackModel };
    };

    try {
      const startedAt = Date.now();
      const raw = await this.dispatcher.dispatch(task.agent, task.id, buildBody());
      const parsed = parseWorkerResult(raw);
      const duration = Date.now() - startedAt;

      const model = parsed.usage.model ?? fallbackModel;
      const inputTokens = parsed.usage.inputTokens ?? 0;
      const outputTokens = parsed.usage.outputTokens ?? 0;

      this.emit('agent:status', {
        taskId: task.id,
        agent: task.agent,
        status: 'success',
        progress: 100,
        model,
      });
      this.emit('agent:output', {
        taskId: task.id,
        agent: task.agent,
        content: parsed.content,
        tokens: inputTokens + outputTokens,
        cost: 0,
        duration,
        model,
        inputTokens,
        outputTokens,
      });

      // T5：输出质检（Validator 用本地网关 LLM）
      const verdict = await validateOutput({
        taskId: task.id,
        role: task.agent,
        title: task.title,
        userMessage,
        output: parsed.content,
        upstreamOutputs: upstreamOutputsOf(),
        emit: this.emit,
        log: this.log,
      });

      if (verdict.pass) {
        await experienceMemory.record({
          taskType: task.title,
          agent: task.agent,
          model,
          success: true,
        });
        return {
          taskId: task.id,
          role: task.agent,
          output: parsed.content,
          model,
          inputTokens,
          outputTokens,
          duration,
        };
      }

      // 质检不过 → Rollback 恢复链
      const outcome = await recoverTask({
        taskId: task.id,
        taskTitle: task.title,
        role: task.agent,
        errorType: verdict.failCodes?.[0] ?? 'POLICY_ERROR',
        fromModel: model,
        failureMessage: verdict.issues?.join('; '),
        rerun,
        emit: this.emit,
        log: this.log,
      });

      if (outcome.recovered && outcome.output !== undefined) {
        await experienceMemory.record({
          taskType: task.title,
          agent: task.agent,
          model: outcome.model ?? model,
          success: true,
        });
        return {
          taskId: task.id,
          role: task.agent,
          output: outcome.output,
          model: outcome.model ?? model,
          inputTokens,
          outputTokens,
          duration,
        };
      }

      await experienceMemory.record({
        taskType: task.title,
        agent: task.agent,
        model,
        success: false,
        failReason: `质检未通过: ${verdict.issues?.join('; ') ?? 'unknown'}`,
      });
      return {
        taskId: task.id,
        role: task.agent,
        output: parsed.content,
        model,
        inputTokens,
        outputTokens,
        duration,
      };
    } catch (err: any) {
      const message = err?.message ?? String(err);
      this.emit('agent:status', {
        taskId: task.id,
        agent: task.agent,
        status: 'failed',
        progress: 100,
        model: fallbackModel,
      });
      this.emit('agent:error', {
        taskId: task.id,
        agent: task.agent,
        errorType: 'MODEL_ERROR',
        message,
      });

      // T5：执行失败 → Rollback 恢复链
      const outcome = await recoverTask({
        taskId: task.id,
        taskTitle: task.title,
        role: task.agent,
        errorType: 'MODEL_ERROR',
        fromModel: fallbackModel,
        failureMessage: message,
        rerun,
        emit: this.emit,
        log: this.log,
      });

      if (outcome.recovered && outcome.output !== undefined) {
        return {
          taskId: task.id,
          role: task.agent,
          output: outcome.output,
          model: outcome.model ?? fallbackModel,
          duration: 0,
        };
      }

      await experienceMemory.record({
        taskType: task.title,
        agent: task.agent,
        model: fallbackModel,
        success: false,
        failReason: message,
      });
      return {
        taskId: task.id,
        role: task.agent,
        output: `Error: ${message}`,
        duration: 0,
      };
    }
  }
}
