import { SkillAgent, type SkillValidation } from '../skill-agent';
import type { AgentConfig, AgentContext, SkillDefinition } from '../../types';
import skillJson from './skill.json';
import { SYSTEM_PROMPT, buildRollbackPrompt } from './prompt';
import { validateRollbackDecision } from './validator';
import { getRollbackTools } from './tools';
import type { RollbackDecision } from './schema';

const SKILL = skillJson as unknown as SkillDefinition;

/**
 * Rollback Agent Skill v1.0 — Fault Self-Healing.
 *
 * Consumes ErrorType / failCodes from the Validator Output Firewall, checks
 * the latest Snapshot Store and Experience Memory, then decides between
 * snapshot restore, model switch, rerun, or human escalation.
 */
export class RollbackAgent extends SkillAgent<RollbackDecision> {
  protected readonly skill = SKILL;

  constructor() {
    const config: AgentConfig = {
      role: 'rollback',
      model: 'auto',
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.1,
      maxTokens: 2048,
      retryCount: 1,
      timeout: 30000,
    };
    super(config);
  }

  protected buildSkillPrompt(context: AgentContext): string {
    return buildRollbackPrompt(context);
  }

  protected validateSkillOutput(raw: string): SkillValidation<RollbackDecision> {
    return validateRollbackDecision(raw);
  }
}

export { getRollbackTools };
