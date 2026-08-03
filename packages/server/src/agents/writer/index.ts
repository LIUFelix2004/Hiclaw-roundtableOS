import { SkillAgent, type SkillValidation } from '../skill-agent';
import type { AgentConfig, AgentContext, SkillDefinition } from '../../types';
import skillJson from './skill.json';
import { SYSTEM_PROMPT, buildWriterPrompt } from './prompt';
import { validateWriterOutput } from './validator';
import { getWriterTools } from './tools';
import type { WriterOutput } from './schema';

const SKILL = skillJson as unknown as SkillDefinition;

/**
 * Writer Skill v1.0
 * Structured final report generation from upstream Skill outputs.
 */
export class WriterAgent extends SkillAgent<WriterOutput> {
  protected readonly skill = SKILL;

  constructor() {
    const config: AgentConfig = {
      role: 'writer',
      model: 'auto',
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.5,
      maxTokens: 4096,
      retryCount: 2,
      timeout: 60000,
    };
    super(config);
  }

  protected buildSkillPrompt(context: AgentContext): string {
    return buildWriterPrompt(context);
  }

  protected validateSkillOutput(raw: string): SkillValidation<WriterOutput> {
    return validateWriterOutput(raw);
  }
}

export { getWriterTools };
