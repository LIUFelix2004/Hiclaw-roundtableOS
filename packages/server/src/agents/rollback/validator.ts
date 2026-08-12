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

  const out = parsed as Record<string, any>;
  // Normalize snake_case keys from LLM output
  if (out.from_model && !out.fromModel) out.fromModel = out.from_model;
  if (out.to_model !== undefined && out.toModel === undefined) out.toModel = out.to_model;
  if (out.error_type && !out.errorType) out.errorType = out.error_type;
  if (out.manual_instructions !== undefined && out.manualInstructions === undefined) out.manualInstructions = out.manual_instructions;
  // Apply defaults for missing fields
  if (!out.reason) out.reason = 'auto-recovery';
  if (!out.fromModel) out.fromModel = 'gpt-5.5';
  if (out.toModel === undefined) out.toModel = null;
  if (typeof out.attempts !== 'number') out.attempts = 0;
  if (typeof out.confidence !== 'number') out.confidence = 0.5;
  if (!out.strategy) out.strategy = 'rerun';
  if (!out.errorType) out.errorType = 'MODEL_ERROR';

  if (!VALID_STRATEGIES.includes(out.strategy as RollbackStrategy)) {
    issues.push('strategy 必须是 snapshot_restore/model_switch/rerun/human_escalation 之一');
  }
  if (!VALID_ERROR_TYPES.includes(out.errorType as ErrorType)) {
    issues.push('errorType 必须是 DATA_ERROR/MODEL_ERROR/TOOL_ERROR/POLICY_ERROR 之一');
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
