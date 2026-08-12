import { SkillAgent, type SkillValidation } from '../skill-agent';
import type { AgentConfig, AgentContext, SkillDefinition } from '../../types';
import skillJson from './skill.json';
import { SYSTEM_PROMPT, buildAnalystPrompt } from './prompt';
import { validateAnalystOutput } from './validator';
import { getAnalystTools } from './tools';
import type { AnalystOutput } from './schema';

const SKILL = skillJson as unknown as SkillDefinition;

/**
 * Analyst Skill v1.0
 * Declarative Skill: model routing is delegated to NewAPI ("auto"),
 * output is validated against AnalystOutput Schema, and the shared
 * SkillAgent runtime owns Trace / Snapshot / retry / error classification.
 */
export class AnalystAgent extends SkillAgent<AnalystOutput> {
  protected readonly skill = SKILL;

  constructor() {
    const config: AgentConfig = {
      role: 'analyst',
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
    return buildAnalystPrompt(context);
  }

  protected validateSkillOutput(raw: string): SkillValidation<AnalystOutput> {
    return validateAnalystOutput(raw);
  }
}

export { getAnalystTools };
