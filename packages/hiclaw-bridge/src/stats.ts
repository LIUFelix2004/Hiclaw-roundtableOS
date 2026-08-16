import type { AgentRole } from '@hermes/shared';

/**
 * bridge 侧运行统计（对齐 legacy packages/server/src/stats.ts 的响应结构）。
 *
 * studio 仪表盘经 BFF `/api/competition/stats` 聚合读取 `/api/stats/tokens`
 * 与 `/api/stats/health`；bridge 之前只有 `/health`，导致 BFF 兜底返回
 * 502 competition_backend_unavailable，仪表盘全空。
 *
 * 数据只来自 bridge 实际转发过的事件，不做任何估算或补零。
 */

interface TokenEvent {
  agent: string;
  tokens: number;
  ts: number;
}

interface CostEvent {
  model: string;
  cost: number;
  ts: number;
}

interface RoundtableRecord {
  topic: string;
  rounds: number;
  ts: number;
}

const RECENT_LIMIT = 50;

export class BridgeStats {
  private readonly startedAt = Date.now();
  private readonly tokensByAgent = new Map<string, number>();
  private readonly costByModel = new Map<string, number>();
  private readonly tokenEvents: TokenEvent[] = [];
  private readonly costEvents: CostEvent[] = [];
  private readonly roundtables: RoundtableRecord[] = [];

  private lastConsensus: unknown = null;
  private failures = 0;
  private lastError: string | null = null;

  /** 当前进行中的任务 / 圆桌数（连接级并发） */
  activeTasks = 0;
  activeRoundtables = 0;

  /** 完成的任务次数（DAG + 圆桌），作为仪表盘「总运行数」的分母 */
  private runs = 0;

  recordOutput(agent: AgentRole | string, tokens?: number, cost?: number, model?: string): void {
    if (typeof tokens === 'number' && tokens > 0) {
      this.tokensByAgent.set(agent, (this.tokensByAgent.get(agent) ?? 0) + tokens);
      this.tokenEvents.push({ agent, tokens, ts: Date.now() });
      if (this.tokenEvents.length > RECENT_LIMIT) this.tokenEvents.shift();
    }
    if (typeof cost === 'number' && cost > 0) {
      const key = model || 'unknown';
      this.costByModel.set(key, (this.costByModel.get(key) ?? 0) + cost);
      this.costEvents.push({ model: key, cost, ts: Date.now() });
      if (this.costEvents.length > RECENT_LIMIT) this.costEvents.shift();
    }
  }

  recordRun(): void {
    this.runs += 1;
  }

  recordRoundtable(topic: string, rounds: number): void {
    this.roundtables.push({ topic, rounds, ts: Date.now() });
    if (this.roundtables.length > RECENT_LIMIT) this.roundtables.shift();
  }

  recordConsensus(consensus: unknown): void {
    this.lastConsensus = consensus;
  }

  recordFailure(message: string): void {
    this.failures += 1;
    this.lastError = message;
  }

  getTokens() {
    return {
      total: [...this.tokensByAgent.values()].reduce((s, v) => s + v, 0),
      byAgent: Object.fromEntries(this.tokensByAgent),
      recent: [...this.tokenEvents],
    };
  }

  getCost() {
    return {
      total: [...this.costByModel.values()].reduce((s, v) => s + v, 0),
      byModel: Object.fromEntries(this.costByModel),
      recent: [...this.costEvents],
    };
  }

  getRoundtable() {
    return {
      total: this.roundtables.length,
      rounds: this.roundtables.reduce((s, r) => s + r.rounds, 0),
      topics: [...this.roundtables],
      lastConsensus: this.lastConsensus,
    };
  }

  getHealth(mode: 'live' | 'mock') {
    return {
      status: 'ok',
      service: 'hermes-hiclaw-bridge',
      mode,
      mock: mode === 'mock',
      uptime: (Date.now() - this.startedAt) / 1000,
      activeTasks: this.activeTasks,
      activeRoundtables: this.activeRoundtables,
      // bridge 侧尚未接入 Snapshot / Experience Memory（属 T5 治理链路），
      // memoryRecords 用已完成运行数代替，让仪表盘的「总运行数」有真实来源。
      snapshotCount: 0,
      memoryRecords: this.runs,
      failures: this.failures,
      rollbackRecovered: 0,
      rollbackEscalated: 0,
      lastError: this.lastError,
    };
  }
}

export const bridgeStats = new BridgeStats();
