import type { SharedEmit } from './event-mapping';
import { Planner, type PlanResult } from './planner';
import { TaskScheduler, type ScheduledResult } from './scheduler';

/**
 * DAG 编排入口（T3）：对齐 legacy packages/server/src/index.ts 的
 * task:create 流程，把 Planner 拆解与 Scheduler 远程执行串成闭环。
 *
 * 流程：plan → emit task:plan → scheduler.execute（emit agent:status/agent:output）→ 末尾汇总 agent:output。
 * validator / rollback 恢复链属 T5，本阶段不参与。
 */

export interface DagRunResult {
  plan: PlanResult;
  results: ScheduledResult[];
  summary: string;
}

export interface DagRunnerOptions {
  planner: Planner;
  scheduler: TaskScheduler;
  emit?: SharedEmit;
  log?: (message: string) => void;
}

export class DagRunner {
  private readonly planner: Planner;
  private readonly scheduler: TaskScheduler;
  private readonly emit: SharedEmit;
  private readonly log: (message: string) => void;

  constructor(opts: DagRunnerOptions) {
    this.planner = opts.planner;
    this.scheduler = opts.scheduler;
    this.emit = opts.emit ?? (() => {});
    this.log = opts.log ?? (() => {});
  }

  /** 执行一次完整 DAG：拆解 → 并行执行 → 汇总 */
  async run(message: string, context = ''): Promise<DagRunResult> {
    const plan = await this.planner.plan(message, context);
    this.log(`[dag] ${plan.source ?? 'rules'} 拆解 ${plan.tasks.length} 个子任务: ${plan.reasoning}`);

    this.emit('task:plan', {
      tasks: plan.tasks,
      reasoning: plan.reasoning,
      source: plan.source,
    });

    const results = await this.scheduler.execute(plan.tasks, message);

    const summary = results
      .map((r) => `[${r.role}] ${r.output.slice(0, 300)}${r.output.length > 300 ? '...' : ''}`)
      .join('\n\n---\n\n');

    this.emit('agent:output', {
      taskId: `task_${Date.now()}`,
      agent: 'writer',
      content: `## Task Complete\n\n${summary}`,
      tokens: results.reduce((s, r) => s + ((r.inputTokens ?? 0) + (r.outputTokens ?? 0)), 0),
      cost: 0,
      duration: results.reduce((s, r) => s + r.duration, 0),
    });

    return { plan, results, summary };
  }
}
