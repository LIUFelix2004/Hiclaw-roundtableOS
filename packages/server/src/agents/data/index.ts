import { SkillAgent, type SkillValidation } from '../skill-agent';
import type { AgentConfig, AgentContext, SkillDefinition } from '../../types';
import skillJson from './skill.json';
import { SYSTEM_PROMPT, buildDataPrompt } from './prompt';
import { validateDataOutput } from './validator';
import { getDataTools } from './tools';
import type { DataOutput } from './schema';

const SKILL = skillJson as unknown as SkillDefinition;

/**
 * Data Skill v1.0
 * Structured data collection with evidence citation and gap flagging.
 */
export class DataAgent extends SkillAgent<DataOutput> {
  protected readonly skill = SKILL;

  constructor() {
    const config: AgentConfig = {
      role: 'data',
      model: 'auto',
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.2,
      maxTokens: 3072,
      retryCount: 4,
      timeout: 120000,
    };
    super(config);
  }

  protected buildSkillPrompt(context: AgentContext): string {
    return buildDataPrompt(context);
  }

  protected validateSkillOutput(raw: string): SkillValidation<DataOutput> {
    return validateDataOutput(raw);
  }
}

export { getDataTools };
