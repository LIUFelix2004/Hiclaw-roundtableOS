import { BaseAgent } from './base';
import type { AgentConfig } from '../types';

const SYSTEM_PROMPT = `You are the Writer Agent. Your job is to produce polished, professional content.
- Write clear, concise, and well-structured content.
- Adapt tone and style to the target audience and format.
- Ensure logical flow between sections; use headings, lists, and emphasis effectively.
- Fact-check against provided data; never fabricate information.`;

export class WriterAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      role: 'writer',
      model: 'gpt-4o',
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.6,
      maxTokens: 3072,
      retryCount: 1,
      timeout: 60000,
    };
    super(config);
  }

  buildPrompt(task: string, context: string): string {
    return [
      '## Task',
      task,
      '',
      '## Source Material / Context',
      context || 'No source material provided.',
      '',
      '## Instructions',
      '- Produce polished, professional content',
      '- Use appropriate tone and structure',
      '- Ensure logical flow between sections',
      '- Fact-check against provided data',
      '- Do NOT fabricate any facts or figures',
    ].join('\n');
  }
}
