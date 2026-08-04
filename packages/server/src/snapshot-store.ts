import type { AgentRole, AgentSnapshot } from '@hermes/shared';

/**
 * In-process Snapshot Store.
 *
 * Every Skill execution saves running/success/failure snapshots here so the
 * Rollback Engine can restore a previously validated output or rebuild the
 * rerun context after a model failure.
 */
export class SnapshotStore {
  private snapshots = new Map<string, AgentSnapshot>();

  save(snapshot: AgentSnapshot): void {
    this.snapshots.set(this.key(snapshot.taskId, snapshot.agent), snapshot);
  }

  latest(taskId: string, agent: AgentRole): AgentSnapshot | undefined {
    return this.snapshots.get(this.key(taskId, agent));
  }

  latestSuccess(taskId: string, agent: AgentRole): AgentSnapshot | undefined {
    const snapshot = this.latest(taskId, agent);
    return snapshot?.status === 'success' ? snapshot : undefined;
  }

  all(): AgentSnapshot[] {
    return Array.from(this.snapshots.values());
  }

  stats(): { total: number; byAgent: Record<string, number> } {
    const byAgent: Record<string, number> = {};
    for (const snapshot of this.snapshots.values()) {
      byAgent[snapshot.agent] = (byAgent[snapshot.agent] ?? 0) + 1;
    }
    return { total: this.snapshots.size, byAgent };
  }

  clear(): void {
    this.snapshots.clear();
  }

  private key(taskId: string, agent: AgentRole): string {
    return `${taskId}:${agent}`;
  }
}

export const snapshotStore = new SnapshotStore();
