import { BaseAgent } from './base';
import type { AgentConfig } from '../types';

const SYSTEM_PROMPT = `You are the Analyst Agent. Your job is to analyze data and extract actionable insights.
- Examine data from multiple angles; identify trends, outliers, and correlations.
- Draw evidence-based conclusions; quantify uncertainty where possible.
- Provide strategic recommendations with clear rationale.
- Challenge assumptions and highlight risks.`;

export class AnalystAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      role: 'analyst',
      model: 'gpt-4o',
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.4,
      maxTokens: 2048,
      retryCount: 1,
      timeout: 45000,
    };
    super(config);
  }

  buildPrompt(task: string, context: string): string {
    return [
      '## Task',
      task,
      '',
      '## Context / Data to Analyze',
      context || 'No data provided for analysis.',
      '',
      '## Instructions',
      '- Analyze data from multiple angles',
      '- Identify trends, outliers, and correlations',
      '- Provide evidence-based conclusions',
      '- Give strategic recommendations with rationale',
      '- Highlight risks and assumptions',
    ].join('\n');
  }
}
