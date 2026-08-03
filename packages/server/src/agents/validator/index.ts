import { SkillAgent, type SkillValidation } from '../skill-agent';
import type { AgentConfig, AgentContext, SkillDefinition } from '../../types';
import skillJson from './skill.json';
import { SYSTEM_PROMPT, buildValidatorPrompt } from './prompt';
import { validateValidatorOutput } from './validator';
import { getValidatorTools } from './tools';
import type { ValidatorOutput } from './schema';

const SKILL = skillJson as unknown as SkillDefinition;

/**
 * Validator Skill v1.0 — Output Firewall.
 *
 * Runs after every agent artifact, scores four dimensions, and emits
 * failCodes aligned with ErrorType so Rollback / Experience Memory can
 * consume the verdict without translation.
 */
export class ValidatorAgent extends SkillAgent<ValidatorOutput> {
  protected readonly skill = SKILL;

  constructor() {
    const config: AgentConfig = {
      role: 'validator',
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
    return buildValidatorPrompt(context);
  }

  protected validateSkillOutput(raw: string): SkillValidation<ValidatorOutput> {
    return validateValidatorOutput(raw);
  }
}

export { getValidatorTools };
