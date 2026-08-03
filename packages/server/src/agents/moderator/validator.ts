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

export function validateModeratorOutput(raw: string): ModeratorValidation {
  const issues: string[] = [];
  const { parsed, error } = parseJsonObject(raw);
  if (error) {
    return { pass: false, output: null, issues: [`输出不是合法 JSON: ${error}`] };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { pass: false, output: null, issues: ['输出必须是 JSON 对象'] };
  }

  const out = parsed as Partial<ModeratorOutput>;
  if (typeof out.meetingSummary !== 'string' || out.meetingSummary.trim() === '') {
    issues.push('meetingSummary 必须是非空字符串');
  }
  if (typeof out.finalSolution !== 'string' || out.finalSolution.trim() === '') {
    issues.push('finalSolution 必须是非空字符串');
  }

  if (!Array.isArray(out.agentContributions)) {
    issues.push('agentContributions 必须是数组');
  } else {
    out.agentContributions.forEach((item, index) => {
      if (typeof item !== 'object' || item === null) {
        issues.push(`agentContributions[${index}] 必须是对象`);
        return;
      }
      const c = item as Partial<ModeratorContribution>;
      if (typeof c.agent !== 'string' || c.agent.trim() === '') {
        issues.push(`agentContributions[${index}].agent 必须是非空字符串`);
      }
      if (typeof c.contribution !== 'string' || c.contribution.trim() === '') {
        issues.push(`agentContributions[${index}].contribution 必须是非空字符串`);
      }
    });
  }

  if (!Array.isArray(out.executionTasks)) {
    issues.push('executionTasks 必须是数组');
  } else {
    out.executionTasks.forEach((task, index) => {
      if (typeof task !== 'object' || task === null) {
        issues.push(`executionTasks[${index}] 必须是对象`);
        return;
      }
      const t = task as Partial<RoundtableTask>;
      if (typeof t.agent !== 'string' || t.agent.trim() === '') {
        issues.push(`executionTasks[${index}].agent 必须是非空字符串`);
      }
      if (typeof t.objective !== 'string' || t.objective.trim() === '') {
        issues.push(`executionTasks[${index}].objective 必须是非空字符串`);
      }
      if (typeof t.input !== 'string' || t.input.trim() === '') {
        issues.push(`executionTasks[${index}].input 必须是非空字符串`);
      }
      if (typeof t.expectedOutput !== 'string' || t.expectedOutput.trim() === '') {
        issues.push(`executionTasks[${index}].expectedOutput 必须是非空字符串`);
      }
      if (t.deadline !== undefined && (typeof t.deadline !== 'string' || t.deadline.trim() === '')) {
        issues.push(`executionTasks[${index}].deadline 必须是非空字符串`);
      }
    });
  }

  if (!isStringArray(out.risks)) {
    issues.push('risks 必须全部是字符串数组');
  }
  if (!isNumberInRange(out.confidence, 0, 1)) {
    issues.push('confidence 必须是 0-1 数字');
  }

  if (issues.length > 0) {
    return { pass: false, output: null, issues };
  }

  return {
    pass: true,
    output: {
      meetingSummary: (out as ModeratorOutput).meetingSummary,
      finalSolution: (out as ModeratorOutput).finalSolution,
      agentContributions: (out as ModeratorOutput).agentContributions,
      executionTasks: (out as ModeratorOutput).executionTasks,
      risks: (out as ModeratorOutput).risks,
      confidence: (out as ModeratorOutput).confidence,
    },
    issues: [],
  };
}
