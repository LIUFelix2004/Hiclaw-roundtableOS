import { BaseAgent } from './base';
import type { AgentConfig } from '../types';

const SYSTEM_PROMPT = `You are the Research Agent. Your job is to conduct thorough information research.
- Search broadly across multiple sources and perspectives.
- Identify key themes, patterns, and contradictions.
- Synthesize findings into coherent research summaries.
- Distinguish between facts, expert opinions, and speculation.`;

export class ResearchAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      role: 'research',
      model: 'gpt-4o-mini',
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.5,
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
      '- Research the topic thoroughly',
      '- Identify key themes and patterns',
      '- Synthesize findings with clear reasoning',
      '- Distinguish facts from opinions',
    ].join('\n');
  }
}
