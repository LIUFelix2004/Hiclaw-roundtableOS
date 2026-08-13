import type { ModeratorOutput, ModeratorContribution } from './schema';
import type { RoundtableTask } from '@hermes/shared';
import {
  isNumberInRange,
  isStringArray,
  parseJsonObject,
} from '../skill-validator';

export interface ModeratorValidation {
  pass: boolean;
  output: ModeratorOutput | null;
  issues: string[];
}

function snakeToCamel(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

export function validateModeratorOutput(raw: string): ModeratorValidation {
  const issues: string[] = [];
  const { parsed, error } = parseJsonObject(raw);
  if (error) {
    return { pass: false, output: null, issues: [`输出不是合法 JSON: ${error}`] };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { pass: false, output: null, issues: ['输出必须是 JSON 对象'] };
  }

  const normalized = snakeToCamel(parsed as Record<string, any>);
  const out = normalized as Partial<ModeratorOutput>;

  if (typeof out.meetingSummary !== 'string' || out.meetingSummary.trim() === '') {
    out.meetingSummary = out.finalSolution || 'Roundtable synthesis complete';
  }
  if (typeof out.finalSolution !== 'string' || out.finalSolution.trim() === '') {
    out.finalSolution = out.meetingSummary || 'No final solution provided';
  }

  if (!Array.isArray(out.agentContributions)) {
    out.agentContributions = [];
  } else {
    out.agentContributions = out.agentContributions.map((item: any) => {
      if (typeof item !== 'object' || item === null) return { agent: 'unknown', contribution: '' };
      const c = snakeToCamel(item) as Partial<ModeratorContribution>;
      return {
        agent: typeof c.agent === 'string' ? c.agent : 'unknown',
        contribution: typeof c.contribution === 'string' ? c.contribution : '',
      };
    });
  }

  if (!Array.isArray(out.executionTasks)) {
    out.executionTasks = [];
  } else {
    out.executionTasks = out.executionTasks.map((task: any) => {
      if (typeof task !== 'object' || task === null) return { agent: 'unknown', objective: '', input: '', expectedOutput: '' };
      const t = snakeToCamel(task) as Partial<RoundtableTask>;
      return {
        agent: typeof t.agent === 'string' ? t.agent : 'unknown',
        objective: typeof t.objective === 'string' ? t.objective : '',
        input: typeof t.input === 'string' ? t.input : '',
        expectedOutput: typeof t.expectedOutput === 'string' ? t.expectedOutput : '',
        ...(t.deadline ? { deadline: t.deadline } : {}),
      };
    });
  }

  if (!isStringArray(out.risks)) {
    if (Array.isArray(out.risks)) {
      out.risks = (out.risks as any[]).map((r: any) => typeof r === 'string' ? r : JSON.stringify(r));
    } else {
      out.risks = [];
    }
  }

  if (!isNumberInRange(out.confidence, 0, 1)) {
    out.confidence = 0.7;
  }

  return {
    pass: true,
    output: {
      meetingSummary: out.meetingSummary!,
      finalSolution: out.finalSolution!,
      agentContributions: out.agentContributions as ModeratorContribution[],
      executionTasks: out.executionTasks as RoundtableTask[],
      risks: out.risks as string[],
      confidence: out.confidence!,
    },
    issues: [],
  };
}
