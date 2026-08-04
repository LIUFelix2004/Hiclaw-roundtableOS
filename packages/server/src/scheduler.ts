import type { SubTask, AgentRole } from '@hermes/shared';
import type { AgentResult, ExecutionContext } from './types';
import { BaseAgent } from './agents/base';
import { classifyError } from './agents/skill-agent';
import { DataAgent } from './agents/data';
import { ResearchAgent } from './agents/research';
import { AnalystAgent } from './agents/analyst';
import { WriterAgent } from './agents/writer';
import { ValidatorAgent } from './agents/validator';
import type { ValidatorOutput } from './agents/validator/schema';
import { RollbackEngine } from './rollback-engine';
import { getDefaultModel } from './llm';

export class ValidationBlockedError extends Error {
  constructor(
    public readonly verdict: ValidatorOutput,
    public readonly role: AgentRole,
    public readonly taskId: string,
  ) {
    super(
      `Validator 拦截 ${role} 输出: ${verdict.failCodes.join(', ') || 'UNKNOWN'} - ${verdict.issues.join('; ')}`,
    );
    this.name = 'ValidationBlockedError';
  }
}

/**
 * TaskScheduler: executes SubTasks respecting their DAG dependencies.
 *
 * Uses Kahn's algorithm for topological sort, then executes each
 * level in parallel where dependencies are satisfied.
 */
export class TaskScheduler {
  private agents: Map<AgentRole, BaseAgent>;
  private validatorAgent = new ValidatorAgent();
  private rollbackEngine = new RollbackEngine();

  constructor() {
    this.agents = new Map();
    this.agents.set('data', new DataAgent());
    this.agents.set('research', new ResearchAgent());
    this.agents.set('analyst', new AnalystAgent());
    this.agents.set('writer', new WriterAgent());
  }

  /**
   * Execute all subtasks respecting DAG order.
   * Returns results in execution order (not necessarily DAG order —
   * independent tasks may complete in parallel).
   */
  async execute(
    tasks: SubTask[],
    userMessage: string,
    ctx: ExecutionContext,
  ): Promise<AgentResult[]> {
    if (tasks.length === 0) return [];

    const results: AgentResult[] = [];
    const completed = new Map<string, string>(); // taskId → output
    const remaining = new Map(tasks.map((t) => [t.id, t]));

    let round = 0;
    const maxRounds = tasks.length * 2; // safety valve
    while (remaining.size > 0 && round < maxRounds) {
      round++;

      // Find tasks whose dependencies are all completed
      const ready: SubTask[] = [];
      for (const [, task] of remaining) {
        if (task.dependsOn.every((depId) => completed.has(depId))) {
          ready.push(task);
        }
      }

      if (ready.length === 0) {
        // DAG has a cycle or unresolvable dependency
        ctx.emit('error', {
          message: `Scheduler: deadlock detected at round ${round}. Remaining: ${remaining.size} tasks.`,
        });
        break;
      }

      // Execute ready tasks in parallel
      const batchResults = await Promise.all(
        ready.map(async (task) => {
          const agent = this.agents.get(task.agent);
          if (!agent) {
            ctx.emit('error', { message: `No agent found for role: ${task.agent}` });
            return {
              taskId: task.id,
              role: task.agent,
              output: `Error: no agent for role ${task.agent}`,
              tokens: 0,
              cost: 0,
              duration: 0,
            } satisfies AgentResult;
          }

          // Build context from upstream task outputs
          const upstreamContext = task.dependsOn
            .map((depId) => {
              const out = completed.get(depId);
              if (!out) return '';
              const depTask = tasks.find((t) => t.id === depId);
              const label = depTask ? `[${depTask.agent}] ${depTask.title}` : depId;
              return `--- Output from ${label} ---\n${out.slice(0, 2000)}`;
            })
            .join('\n\n');

          const result = await this.executeWithRecovery(
            agent,
            task,
            userMessage,
            upstreamContext,
            ctx,
          );
          await this.validateWithRecovery(
            result,
            userMessage,
            task,
            agent,
            upstreamContext,
            ctx,
          );
          return result;
        }),
      );

      // Record results
      for (const result of batchResults) {
        completed.set(result.taskId, result.output);
        results.push(result);
      }

      // Remove completed tasks
      for (const task of ready) {
        remaining.delete(task.id);
      }
    }

    return results;
  }

  getAgent(role: AgentRole): BaseAgent | undefined {
    return this.agents.get(role);
  }

  private async executeWithRecovery(
    agent: BaseAgent,
    task: SubTask,
    userMessage: string,
    context: string,
    ctx: ExecutionContext,
  ): Promise<AgentResult> {
    try {
      return await agent.execute(task.id, task.title, userMessage, context, ctx);
    } catch (err: any) {
      const errorType = (err as any).errorType ?? classifyError(err);
      const fromModel = (err as any).model ?? getDefaultModel(task.agent);
      const outcome = await this.rollbackEngine.recoverAgent({
        taskId: task.id,
        taskTitle: task.title,
        role: task.agent,
        errorType,
        fromModel,
        input: userMessage,
        context,
        agent,
        ctx,
        failureMessage: err?.message ?? String(err),
      });
      if (!outcome.recovered || !outcome.result) {
        throw new Error(
          `HUMAN_ESCALATION: ${task.agent} 任务失败且 Rollback 无法恢复 [${errorType}]: ${outcome.reason}`,
        );
      }
      return outcome.result;
    }
  }

  private async validateWithRecovery(
    result: AgentResult,
    userMessage: string,
    task: SubTask,
    agent: BaseAgent,
    context: string,
    ctx: ExecutionContext,
  ): Promise<void> {
    const maxRecoveries = 5;
    let current = result;
    for (let attempt = 0; attempt < maxRecoveries; attempt++) {
      try {
        await this.validateResult(current, userMessage, ctx);
        return;
      } catch (err) {
        if (!(err instanceof ValidationBlockedError)) throw err;
        if (attempt === maxRecoveries - 1) throw err;

        const outcome = await this.rollbackEngine.recoverValidation({
          taskId: task.id,
          taskTitle: task.title,
          role: task.agent,
          errorType: err.verdict.failCodes[0] ?? 'POLICY_ERROR',
          fromModel: current.model ?? getDefaultModel(task.agent),
          input: userMessage,
          context,
          agent,
          ctx,
          failureMessage: err.verdict.issues.join('; '),
        });
        if (!outcome.recovered || !outcome.result) throw err;
        current = outcome.result;
      }
    }
  }

  private async validateResult(
    result: AgentResult,
    userMessage: string,
    ctx: ExecutionContext,
  ): Promise<ValidatorOutput> {
    const candidate = `--- Output from [${result.role}] ---\n${result.output}\n\n--- Task ---\n${userMessage}`;
    const vResult = await this.validatorAgent.execute(
      `val_${result.taskId}`,
      `Validate ${result.role}`,
      `校验 ${result.role} 的输出`,
      candidate,
      ctx,
    );
    const verdict = JSON.parse(vResult.output) as ValidatorOutput;

    ctx.emit('validator:result', {
      taskId: result.taskId,
      agent: result.role,
      pass: verdict.pass,
      scores: verdict.scores,
      failCodes: verdict.failCodes,
      issues: verdict.issues,
      reason: verdict.issues.length > 0 ? verdict.issues.join('; ') : undefined,
    });

    if (!verdict.pass) {
      throw new ValidationBlockedError(verdict, result.role, result.taskId);
    }
    return verdict;
  }
}
