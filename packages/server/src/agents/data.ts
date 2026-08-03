import { BaseAgent } from './base';
import type { AgentConfig } from '../types';

const SYSTEM_PROMPT = `You are the Data Agent. Your job is to gather, clean, and structure data.
- Search for relevant data sources, extract key facts and figures.
- Structure output as clear data tables or bullet-point summaries.
- Always cite sources when providing data.
- If data is unavailable, clearly state what's missing and suggest alternatives.`;

export class DataAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      role: 'data',
      model: 'gpt-4o-mini',
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.3,
      maxTokens: 2048,
      retryCount: 2,
      timeout: 30000,
    };
    super(config);
  }

  buildPrompt(task: string, context: string): string {
    return [
      '## Task',
      task,
      '',
      '## Context',
      context || 'No additional context provided.',
      '',
      '## Instructions',
      '- Gather and structure relevant data',
      '- Present data in clear, organized format',
      '- Cite all sources',
      '- Flag any data gaps',
    ].join('\n');
  }
}
