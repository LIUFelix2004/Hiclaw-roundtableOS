import type { SubTask, AgentRole } from '@hermes/shared';
import type { AgentResult, ExecutionContext } from './types';
import { BaseAgent } from './agents/base';
import { DataAgent } from './agents/data';
import { ResearchAgent } from './agents/research';
import { AnalystAgent } from './agents/analyst';
import { WriterAgent } from './agents/writer';

/**
 * TaskScheduler: executes SubTasks respecting their DAG dependencies.
 *
 * Uses Kahn's algorithm for topological sort, then executes each
 * level in parallel where dependencies are satisfied.
 */
export class TaskScheduler {
  private agents: Map<AgentRole, BaseAgent>;

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

          return agent.execute(task.id, task.title, userMessage, upstreamContext, ctx);
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
}
