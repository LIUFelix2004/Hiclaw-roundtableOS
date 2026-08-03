import type { ValidatorOutput, ValidatorScores } from './schema';
import type { ErrorType } from '@hermes/shared';
import {
  isNumberInRange,
  isStringArray,
  parseJsonObject,
} from '../skill-validator';

export interface ValidatorValidation {
  pass: boolean;
  output: ValidatorOutput | null;
  issues: string[];
}

const VALID_FAIL_CODES: ErrorType[] = [
  'DATA_ERROR',
  'MODEL_ERROR',
  'TOOL_ERROR',
  'POLICY_ERROR',
];

export function validateValidatorOutput(raw: string): ValidatorValidation {
  const issues: string[] = [];
  const { parsed, error } = parseJsonObject(raw);
  if (error) {
    return { pass: false, output: null, issues: [`输出不是合法 JSON: ${error}`] };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { pass: false, output: null, issues: ['输出必须是 JSON 对象'] };
  }

  const out = parsed as Partial<ValidatorOutput>;
  if (typeof out.pass !== 'boolean') {
    issues.push('pass 必须是布尔值');
  }

  const scores = out.scores as Partial<ValidatorScores> | undefined;
  if (typeof scores !== 'object' || scores === null) {
    issues.push('scores 必须是对象');
  } else {
    for (const key of ['accuracy', 'completeness', 'safety', 'format'] as const) {
      if (!isNumberInRange(scores[key], 0, 1)) {
        issues.push(`scores.${key} 必须是 0-1 数字`);
      }
    }
  }

  if (!Array.isArray(out.failCodes)) {
    issues.push('failCodes 必须是数组');
  } else if (!out.failCodes.every((code) => VALID_FAIL_CODES.includes(code as ErrorType))) {
    issues.push('failCodes 只能包含 DATA_ERROR/MODEL_ERROR/TOOL_ERROR/POLICY_ERROR');
  }

  if (!isStringArray(out.issues)) {
    issues.push('issues 必须全部是字符串数组');
  }

  if (out.pass === false && Array.isArray(out.failCodes) && out.failCodes.length === 0) {
    issues.push('pass=false 时 failCodes 不能为空');
  }

  if (issues.length > 0) {
    return { pass: false, output: null, issues };
  }

  return {
    pass: true,
    output: {
      pass: (out as ValidatorOutput).pass,
      scores: (out as ValidatorOutput).scores,
      failCodes: (out as ValidatorOutput).failCodes,
      issues: (out as ValidatorOutput).issues,
    },
    issues: [],
  };
}
