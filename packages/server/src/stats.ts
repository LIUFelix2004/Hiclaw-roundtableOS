import { isMockEnabled } from './llm';
import { snapshotStore } from './snapshot-store';
import { experienceMemory } from './experience-memory';

export interface TokenEvent {
  taskId: string;
  agent: string;
  tokens: number;
  cost: number;
  timestamp: number;
}

export interface CostEvent extends TokenEvent {
  model: string;
}

export interface TokenStats {
  total: number;
  byAgent: Record<string, number>;
  recent: TokenEvent[];
}

export interface CostStats {
  total: number;
  byModel: Record<string, number>;
  recent: CostEvent[];
}

export interface RoundtableStats {
  total: number;
  rounds: number;
  topics: Array<{ topic: string; rounds: number; timestamp: number }>;
  lastConsensus?: unknown;
}

export interface HealthStats {
  status: 'ok';
  service: string;
  mock: boolean;
  uptime: number;
  activeTasks: number;
  activeRoundtables: number;
  snapshotCount: number;
  memoryRecords: number;
  failures: number;
  rollbackRecovered: number;
  rollbackEscalated: number;
  lastError?: string;
}

/**
 * In-process dashboard statistics.
 *
 * The Socket.IO emit wrapper in index.ts funnels every runtime event through
 * observe(), so token/cost/roundtable/rollback counters stay in sync with the
 * real execution stream and the /api/stats/* endpoints.
 */
export class StatsService {
  private tokensByAgent = new Map<string, number>();
  private costByModel = new Map<string, number>();
  private tokenEvents: TokenEvent[] = [];
  private costEvents: CostEvent[] = [];
  private roundtables: RoundtableStats['topics'] = [];
  private lastConsensus?: unknown;
  private failures = 0;
  private rollbackRecovered = 0;
  private rollbackEscalated = 0;
  private lastError?: string;
  private startedAt = Date.now();

  observe(event: string, payload: any): void {
    if (event === 'agent:output') {
      this.recordOutput(payload);
      return;
    }
    if (event === 'rollback:complete') {
      if (payload?.recovered) {
        this.rollbackRecovered++;
      } else {
        this.rollbackEscalated++;
      }
      return;
    }
    if (event === 'roundtable:consensus') {
      this.recordRoundtable(payload);
      return;
    }
    if (event === 'agent:error' || event === 'error') {
      this.failures++;
      this.lastError = payload?.message ?? String(payload);
    }
  }

  getTokens(): TokenStats {
    return {
      total: Array.from(this.tokensByAgent.values()).reduce((sum, value) => sum + value, 0),
      byAgent: Object.fromEntries(this.tokensByAgent),
      recent: [...this.tokenEvents],
    };
  }

  getCost(): CostStats {
    return {
      total: Array.from(this.costByModel.values()).reduce((sum, value) => sum + value, 0),
      byModel: Object.fromEntries(this.costByModel),
      recent: [...this.costEvents],
    };
  }

  getRoundtable(): RoundtableStats {
    return {
      total: this.roundtables.length,
      rounds: this.roundtables.reduce((sum, item) => sum + item.rounds, 0),
      topics: [...this.roundtables],
      lastConsensus: this.lastConsensus,
    };
  }

  getHealth(extra: { activeTasks: number; activeRoundtables: number }): HealthStats {
    return {
      status: 'ok',
      service: 'hermes-agentos-server',
      mock: isMockEnabled(),
      uptime: (Date.now() - this.startedAt) / 1000,
      activeTasks: extra.activeTasks,
      activeRoundtables: extra.activeRoundtables,
      snapshotCount: snapshotStore.stats().total,
      memoryRecords: experienceMemory.stats().total,
      failures: this.failures,
      rollbackRecovered: this.rollbackRecovered,
      rollbackEscalated: this.rollbackEscalated,
      lastError: this.lastError,
    };
  }

  reset(): void {
    this.tokensByAgent.clear();
    this.costByModel.clear();
    this.tokenEvents = [];
    this.costEvents = [];
    this.roundtables = [];
    this.lastConsensus = undefined;
    this.failures = 0;
    this.rollbackRecovered = 0;
    this.rollbackEscalated = 0;
    this.lastError = undefined;
    this.startedAt = Date.now();
  }

  private recordOutput(payload: any): void {
    const tokens = Number(payload?.tokens ?? 0);
    const cost = Number(payload?.cost ?? 0);
    const agent = payload?.agent ?? 'unknown';
    const model = payload?.model ?? 'unknown';
    const taskId = payload?.taskId ?? '';
    const timestamp = Date.now();

    this.tokensByAgent.set(agent, (this.tokensByAgent.get(agent) ?? 0) + tokens);
    this.costByModel.set(model, (this.costByModel.get(model) ?? 0) + cost);
    this.tokenEvents.push({ taskId, agent, tokens, cost, timestamp });
    this.costEvents.push({ taskId, agent, model, tokens, cost, timestamp });
    if (this.tokenEvents.length > 50) this.tokenEvents.shift();
    if (this.costEvents.length > 50) this.costEvents.shift();
  }

  private recordRoundtable(payload: any): void {
    const topic = payload?.topic ?? payload?.finalAnswer ?? 'roundtable';
    const rounds = Number(payload?.rounds ?? 0);
    this.roundtables.push({ topic, rounds, timestamp: Date.now() });
    this.lastConsensus = payload;
    if (this.roundtables.length > 20) this.roundtables.shift();
  }
}

export const statsService = new StatsService();
