import { SkillAgent, type SkillValidation } from '../skill-agent';
import type { AgentConfig, AgentContext, SkillDefinition } from '../../types';
import skillJson from './skill.json';
import { SYSTEM_PROMPT, buildModeratorPrompt } from './prompt';
import { validateModeratorOutput } from './validator';
import { getModeratorTools } from './tools';
import type { ModeratorOutput } from './schema';

const SKILL = skillJson as unknown as SkillDefinition;

/**
 * Roundtable Moderator Skill v1.0
 *
 * The coordinator of the AI Roundtable: confirms goals, controls discussion
 * quality, drives convergence, and synthesizes the final solution with an
 * execution plan and risk disclosure. It is not a business executor.
 */
export class ModeratorAgent extends SkillAgent<ModeratorOutput> {
  protected readonly skill = SKILL;

  constructor() {
    const config: AgentConfig = {
      role: 'moderator',
      model: 'auto',
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.3,
      maxTokens: 4096,
      retryCount: 4,
      timeout: 120000,
    };
    super(config);
  }

  protected buildSkillPrompt(context: AgentContext): string {
    return buildModeratorPrompt(context);
  }

  protected validateSkillOutput(raw: string): SkillValidation<ModeratorOutput> {
    return validateModeratorOutput(raw);
  }
}

export { getModeratorTools };
