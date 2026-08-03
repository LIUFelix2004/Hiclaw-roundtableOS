export interface AnalystFinding {
  insight: string;
  evidence: string;
  confidence: number;
}

/**
 * Structured output contract of Analyst Skill v1.0.
 * Validator / Rollback / Experience Memory / downstream Writer all consume
 * this shape, so it must stay stable across versions.
 */
export interface AnalystOutput {
  summary: string;
  keyFindings: AnalystFinding[];
  metrics: Record<string, unknown>;
  risks: string[];
  recommendations: string[];
  assumptions: string[];
  confidence: number;
}
