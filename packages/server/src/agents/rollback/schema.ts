import type { ErrorType } from '@hermes/shared';

export type RollbackStrategy =
  | 'snapshot_restore'
  | 'model_switch'
  | 'rerun'
  | 'human_escalation';

/**
 * Structured decision of the Rollback Agent Skill.
 *
 * The engine executes the strategy; the Skill only decides. Snapshot restore
 * is preferred for transient model/tool errors, model switching for repeated
 * schema/quality failures, and human escalation when all candidates fail.
 */
export interface RollbackDecision {
  strategy: RollbackStrategy;
  reason: string;
  fromModel: string;
  toModel: string | null;
  errorType: ErrorType;
  attempts: number;
  confidence: number;
  manualInstructions?: string | null;
}
