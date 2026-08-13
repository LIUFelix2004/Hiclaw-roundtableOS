import type { AnalystOutput } from './schema';

export interface AnalystValidation {
  pass: boolean;
  output: AnalystOutput | null;
  issues: string[];
}

/**
 * Local schema gate for Analyst output. Runs before the output leaves the
 * Agent, so the standalone Validator Agent receives a well-formed payload.
 */
export function validateAnalystOutput(raw: string): AnalystValidation {
  const issues: string[] = [];
  let parsed: unknown;

  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch (err) {
    return {
      pass: false,
      output: null,
      issues: [`输出不是合法 JSON: ${(err as Error).message}`],
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { pass: false, output: null, issues: ['输出必须是 JSON 对象'] };
  }

  const out = parsed as Record<string, any>;
  // Normalize snake_case keys
  if (out.key_findings && !out.keyFindings) out.keyFindings = out.key_findings;
  // Defaults
  if (!out.summary) out.summary = 'Analysis complete';
  if (!out.keyFindings && !out.key_findings) out.keyFindings = [];
  if (!out.risks) out.risks = [];
  if (!out.recommendations) out.recommendations = [];
  if (!out.assumptions) out.assumptions = [];
  if (typeof out.confidence !== 'number') out.confidence = 0.7;

  if (!Array.isArray(out.keyFindings)) {
    issues.push('keyFindings 必须是数组');
  } else {
    out.keyFindings.forEach((finding, index) => {
      if (typeof finding !== 'object' || finding === null) {
        issues.push(`keyFindings[${index}] 必须是对象`);
        return;
      }
      const f = finding as { insight?: unknown; evidence?: unknown; confidence?: unknown };
      if (typeof f.insight !== 'string' || f.insight.trim() === '') {
        issues.push(`keyFindings[${index}].insight 必须是非空字符串`);
      }
      if (typeof f.evidence !== 'string' || f.evidence.trim() === '') {
        issues.push(`keyFindings[${index}].evidence 必须是非空字符串`);
      }
      if (typeof f.confidence !== 'number' || f.confidence < 0 || f.confidence > 1) {
        issues.push(`keyFindings[${index}].confidence 必须是 0-1 数字`);
      }
    });
  }

  if (
    out.metrics !== undefined &&
    (out.metrics === null || typeof out.metrics !== 'object' || Array.isArray(out.metrics))
  ) {
    issues.push('metrics 必须是对象');
  }

  for (const field of ['risks', 'recommendations', 'assumptions'] as const) {
    const value = out[field];
    if (!Array.isArray(value)) {
      issues.push(`${field} 必须是数组`);
    } else if (!value.every((item) => typeof item === 'string')) {
      issues.push(`${field} 必须全部是字符串`);
    }
  }

  if (typeof out.confidence !== 'number' || out.confidence < 0 || out.confidence > 1) {
    issues.push('confidence 必须是 0-1 数字');
  }

  if (issues.length > 0) {
    return { pass: false, output: null, issues };
  }

  return {
    pass: true,
    output: {
      summary: (out as AnalystOutput).summary,
      keyFindings: (out as AnalystOutput).keyFindings,
      metrics: out.metrics ?? {},
      risks: (out as AnalystOutput).risks,
      recommendations: (out as AnalystOutput).recommendations,
      assumptions: (out as AnalystOutput).assumptions,
      confidence: (out as AnalystOutput).confidence,
    },
    issues: [],
  };
}

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
  }
  return trimmed;
}
