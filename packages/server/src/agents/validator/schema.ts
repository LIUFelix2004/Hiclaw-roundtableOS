import type { ErrorType } from '@hermes/shared';

export interface ValidatorScores {
  accuracy: number;
  completeness: number;
  safety: number;
  format: number;
}

/**
 * Structured verdict of the Output Firewall.
 * failCodes are intentionally aligned with ErrorType so Rollback Agent can
 * consume them directly (DATA / MODEL / TOOL / POLICY).
 */
export interface ValidatorOutput {
  pass: boolean;
  scores: ValidatorScores;
  failCodes: ErrorType[];
  issues: string[];
}
