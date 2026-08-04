import type { RollbackDecision, RollbackStrategy } from './schema';
import type { ErrorType } from '@hermes/shared';
import {
  isNumberInRange,
  parseJsonObject,
} from '../skill-validator';

export interface RollbackValidation {
  pass: boolean;
  output: RollbackDecision | null;
  issues: string[];
}

const VALID_STRATEGIES: RollbackStrategy[] = [
  'snapshot_restore',
  'model_switch',
  'rerun',
  'human_escalation',
];

const VALID_ERROR_TYPES: ErrorType[] = [
  'DATA_ERROR',
  'MODEL_ERROR',
  'TOOL_ERROR',
  'POLICY_ERROR',
];

export function validateRollbackDecision(raw: string): RollbackValidation {
  const issues: string[] = [];
  const { parsed, error } = parseJsonObject(raw);
  if (error) {
    return { pass: false, output: null, issues: [`输出不是合法 JSON: ${error}`] };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { pass: false, output: null, issues: ['输出必须是 JSON 对象'] };
  }

  const out = parsed as Partial<RollbackDecision>;
  if (!VALID_STRATEGIES.includes(out.strategy as RollbackStrategy)) {
    issues.push('strategy 必须是 snapshot_restore/model_switch/rerun/human_escalation 之一');
  }
  if (typeof out.reason !== 'string' || out.reason.trim() === '') {
    issues.push('reason 必须是非空字符串');
  }
  if (typeof out.fromModel !== 'string' || out.fromModel.trim() === '') {
    issues.push('fromModel 必须是非空字符串');
  }
  if (out.toModel !== null && (typeof out.toModel !== 'string' || out.toModel.trim() === '')) {
    issues.push('toModel 必须是字符串或 null');
  }
  if (!VALID_ERROR_TYPES.includes(out.errorType as ErrorType)) {
    issues.push('errorType 必须是 DATA_ERROR/MODEL_ERROR/TOOL_ERROR/POLICY_ERROR 之一');
  }
  if (typeof out.attempts !== 'number' || out.attempts < 0 || !Number.isInteger(out.attempts)) {
    issues.push('attempts 必须是非负整数');
  }
  if (!isNumberInRange(out.confidence, 0, 1)) {
    issues.push('confidence 必须是 0-1 数字');
  }
  if (
    out.manualInstructions !== undefined &&
    out.manualInstructions !== null &&
    (typeof out.manualInstructions !== 'string' || out.manualInstructions.trim() === '')
  ) {
    issues.push('manualInstructions 必须是字符串或 null');
  }

  if (issues.length > 0) {
    return { pass: false, output: null, issues };
  }

  return {
    pass: true,
    output: {
      strategy: (out as RollbackDecision).strategy,
      reason: (out as RollbackDecision).reason,
      fromModel: (out as RollbackDecision).fromModel,
      toModel: (out as RollbackDecision).toModel,
      errorType: (out as RollbackDecision).errorType,
      attempts: (out as RollbackDecision).attempts,
      confidence: (out as RollbackDecision).confidence,
      manualInstructions: (out as RollbackDecision).manualInstructions,
    },
    issues: [],
  };
}
