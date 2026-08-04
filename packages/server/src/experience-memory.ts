import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';
import type { AgentRole, ExperienceRecord } from '@hermes/shared';
import { MODEL_FALLBACKS, getDefaultModel } from './llm';

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

/**
 * Experience Memory: persists execution outcomes to JSON and uses them to
 * influence future model selection and rollback fallback ordering.
 *
 * The file path is resolved lazily so self-tests and demo runs can point
 * HERMES_DATA_DIR to an isolated directory before the first record.
 */
export class ExperienceMemory {
  private records: ExperienceRecord[] = [];
  private loaded = false;
  private writeQueue: Promise<void> = Promise.resolve();

  private get filePath(): string {
    return (
      process.env.HERMES_EXPERIENCE_FILE ??
      path.join(process.env.HERMES_DATA_DIR ?? path.join(process.cwd(), 'data'), 'experience.json')
    );
  }

  async record(input: ExperienceRecordInput): Promise<ExperienceRecord> {
    await this.ensureLoaded();
    const record: ExperienceRecord = {
      id: uuid(),
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

  clear(): void {
    this.records = [];
    this.loaded = true;
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
    const candidates = MODEL_FALLBACKS[role] ?? [getDefaultModel(role)];
    const scored = candidates
      .map((model) => ({ model, score: this.scoreFor(role, model, taskType) }))
      .filter((item) => item.score.attempts > 0)
      .sort((a, b) => this.compareScores(a.score, b.score));
    return scored[0]?.model ?? getDefaultModel(role);
  }

  pickFallback(role: AgentRole, currentModel: string): string[] {
    const candidates = Array.from(
      new Set([...(MODEL_FALLBACKS[role] ?? []), getDefaultModel(role)]),
    ).filter((model) => model !== currentModel);
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
