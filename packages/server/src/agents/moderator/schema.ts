import type { RoundtableTask } from '@hermes/shared';

export interface ModeratorContribution {
  agent: string;
  contribution: string;
}

/**
 * Final output of the Roundtable Moderator Skill.
 * Contains conclusion + execution plan + responsibility assignment + risks,
 * ready for Validator / Rollback / Experience Memory consumption.
 */
export interface ModeratorOutput {
  meetingSummary: string;
  finalSolution: string;
  agentContributions: ModeratorContribution[];
  executionTasks: RoundtableTask[];
  risks: string[];
  confidence: number;
}
