import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'node:crypto';
import type { AgentRole, ExperienceRecord } from '@hermes/shared';
import { GATEWAY_DEFAULT_MODEL } from './llm';

export interface ExperienceRecordInput {
  taskType: string;
  agent: AgentRole;
  model: string;
  success: boolean;
  failReason?: string;
}

interface Score {
  attempts: number;
  success: number;
  failure: number;
  rate: number;
}

/** 角色候选模型：HICLAW_MODEL_<ROLE> 逗号分隔，缺省回退网关默认模型 */
function modelCandidates(role: AgentRole): string[] {
  const env = process.env[`HICLAW_MODEL_${role.toUpperCase()}`];
  if (env) {
    return env
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [GATEWAY_DEFAULT_MODEL];
}

/**
 * Experience Memory（T5）：持久化执行结果到本地 JSON，
 * 用于影响后续模型选择与 Rollback 备选排序。
 *
 * 编排层没有 server 层的多 Provider 模型池，候选模型来自网关侧映射
 * （HICLAW_MODEL_<ROLE>，缺省 deepseek-v4-pro），持久化文件与 server 层
 * 约定一致（HERMES_EXPERIENCE_FILE / HERMES_DATA_DIR/experience.json）。
 */
export class ExperienceMemory {
  private records: ExperienceRecord[] = [];
  private loaded = false;
  private writeQueue: Promise<void> = Promise.resolve();

  private get filePath(): string {
    return (
      process.env.HERMES_EXPERIENCE_FILE ??
      path.join(
        process.env.HERMES_DATA_DIR ?? path.join(process.cwd(), 'data'),
        'experience.json',
      )
    );
  }

  async record(input: ExperienceRecordInput): Promise<ExperienceRecord> {
    await this.ensureLoaded();
    const record: ExperienceRecord = {
      id: randomUUID(),
      taskType: input.taskType,
      agent: input.agent,
      model: input.model,
      success: input.success,
      failReason: input.failReason,
      timestamp: Date.now(),
    };
    this.records.push(record);
    this.writeQueue = this.writeQueue.then(() => this.persist());
    await this.writeQueue;
    return record;
  }

  all(): ExperienceRecord[] {
    return [...this.records];
  }

  stats(): {
    total: number;
    success: number;
    failure: number;
    byAgent: Record<string, Score>;
    byModel: Record<string, Score>;
  } {
    const byAgent: Record<string, Score> = {};
    const byModel: Record<string, Score> = {};
    let success = 0;

    for (const record of this.records) {
      if (record.success) success++;
      this.accumulate(byAgent, record.agent, record.success);
      this.accumulate(byModel, record.model, record.success);
    }

    return {
      total: this.records.length,
      success,
      failure: this.records.length - success,
      byAgent,
      byModel,
    };
  }

  pickModel(role: AgentRole, taskType: string): string {
    const candidates = modelCandidates(role);
    const scored = candidates
      .map((model) => ({ model, score: this.scoreFor(role, model, taskType) }))
      .filter((item) => item.score.attempts > 0)
      .sort((a, b) => this.compareScores(a.score, b.score));
    return scored[0]?.model ?? candidates[0] ?? GATEWAY_DEFAULT_MODEL;
  }

  pickFallback(role: AgentRole, currentModel: string): string[] {
    const candidates = Array.from(new Set(modelCandidates(role))).filter(
      (model) => model !== currentModel,
    );
    return candidates.sort((a, b) =>
      this.compareScores(this.scoreFor(role, a, ''), this.scoreFor(role, b, '')),
    );
  }

  private scoreFor(role: AgentRole, model: string, taskType: string): Score {
    const matches = this.records.filter(
      (r) => r.agent === role && r.model === model && (!taskType || r.taskType === taskType),
    );
    const success = matches.filter((r) => r.success).length;
    return {
      attempts: matches.length,
      success,
      failure: matches.length - success,
      rate: matches.length === 0 ? 0 : success / matches.length,
    };
  }

  private compareScores(a: Score, b: Score): number {
    if (a.attempts === 0 && b.attempts === 0) return 0;
    if (a.attempts === 0) return 1;
    if (b.attempts === 0) return -1;
    if (a.rate !== b.rate) return b.rate - a.rate;
    return b.success - a.success;
  }

  private accumulate(
    target: Record<string, Score>,
    key: string,
    success: boolean,
  ): void {
    const current = target[key] ?? { attempts: 0, success: 0, failure: 0, rate: 0 };
    current.attempts++;
    if (success) {
      current.success++;
    } else {
      current.failure++;
    }
    current.rate = current.success / current.attempts;
    target[key] = current;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as { records?: ExperienceRecord[] };
      if (Array.isArray(parsed.records)) {
        this.records = parsed.records;
      }
    } catch {
      // First run or invalid file: start with an empty memory.
    }
  }

  private async persist(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(
      this.filePath,
      JSON.stringify({ version: 1, updatedAt: Date.now(), records: this.records }, null, 2),
      'utf8',
    );
  }
}

export const experienceMemory = new ExperienceMemory();
