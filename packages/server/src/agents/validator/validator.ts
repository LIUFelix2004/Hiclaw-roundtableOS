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

  const out = parsed as Record<string, any>;
  // Normalize snake_case keys from LLM output
  if (out.fail_codes !== undefined && out.failCodes === undefined) out.failCodes = out.fail_codes;
  // Apply defaults
  if (typeof out.pass !== 'boolean') out.pass = true;
  if (!out.scores) out.scores = { accuracy: 0.8, completeness: 0.8, safety: 1, format: 0.8 };
  if (!Array.isArray(out.failCodes)) out.failCodes = [];
  if (!Array.isArray(out.issues)) out.issues = [];

  const scores = out.scores as Partial<ValidatorScores> | undefined;
  if (typeof scores !== 'object' || scores === null) {
    issues.push('scores 必须是对象');
  } else {
    for (const key of ['accuracy', 'completeness', 'safety', 'format'] as const) {
      if (!isNumberInRange(scores[key], 0, 1)) {
        scores[key] = 0.8;
      }
    }
  }

  if (!out.failCodes.every((code: string) => VALID_FAIL_CODES.includes(code as ErrorType))) {
    out.failCodes = out.failCodes.filter((code: string) => VALID_FAIL_CODES.includes(code as ErrorType));
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
