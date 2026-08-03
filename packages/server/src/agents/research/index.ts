import { SkillAgent, type SkillValidation } from '../skill-agent';
import type { AgentConfig, AgentContext, SkillDefinition } from '../../types';
import skillJson from './skill.json';
import { SYSTEM_PROMPT, buildResearchPrompt } from './prompt';
import { validateResearchOutput } from './validator';
import { getResearchTools } from './tools';
import type { ResearchOutput } from './schema';

const SKILL = skillJson as unknown as SkillDefinition;

/**
 * Research Skill v1.0
 * Multi-source research with evidence chains, contradictions and uncertainty.
 */
export class ResearchAgent extends SkillAgent<ResearchOutput> {
  protected readonly skill = SKILL;

  constructor() {
    const config: AgentConfig = {
      role: 'research',
      model: 'auto',
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.4,
      maxTokens: 3072,
      retryCount: 2,
      timeout: 45000,
    };
    super(config);
  }

  protected buildSkillPrompt(context: AgentContext): string {
    return buildResearchPrompt(context);
  }

  protected validateSkillOutput(raw: string): SkillValidation<ResearchOutput> {
    return validateResearchOutput(raw);
  }
}

export { getResearchTools };
