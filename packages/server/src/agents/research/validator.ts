import type { ResearchOutput, ResearchFinding } from './schema';
import {
  isNumberInRange,
  isStringArray,
  parseJsonObject,
} from '../skill-validator';

export interface ResearchValidation {
  pass: boolean;
  output: ResearchOutput | null;
  issues: string[];
}

export function validateResearchOutput(raw: string): ResearchValidation {
  const issues: string[] = [];
  const { parsed, error } = parseJsonObject(raw);
  if (error) {
    return { pass: false, output: null, issues: [`输出不是合法 JSON: ${error}`] };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { pass: false, output: null, issues: ['输出必须是 JSON 对象'] };
  }

  const out = parsed as Partial<ResearchOutput>;
  if (typeof out.summary !== 'string' || out.summary.trim() === '') {
    issues.push('summary 必须是非空字符串');
  }

  if (!Array.isArray(out.findings)) {
    issues.push('findings 必须是数组');
  } else {
    out.findings.forEach((finding, index) => {
      if (typeof finding !== 'object' || finding === null) {
        issues.push(`findings[${index}] 必须是对象`);
        return;
      }
      const f = finding as Partial<ResearchFinding>;
      if (typeof f.theme !== 'string' || f.theme.trim() === '') {
        issues.push(`findings[${index}].theme 必须是非空字符串`);
      }
      if (typeof f.detail !== 'string' || f.detail.trim() === '') {
        issues.push(`findings[${index}].detail 必须是非空字符串`);
      }
      if (typeof f.evidence !== 'string' || f.evidence.trim() === '') {
        issues.push(`findings[${index}].evidence 必须是非空字符串`);
      }
      if (!isNumberInRange(f.confidence, 0, 1)) {
        issues.push(`findings[${index}].confidence 必须是 0-1 数字`);
      }
    });
  }

  if (!isStringArray(out.contradictions)) {
    issues.push('contradictions 必须全部是字符串数组');
  }
  if (!isStringArray(out.uncertainties)) {
    issues.push('uncertainties 必须全部是字符串数组');
  }
  if (!isStringArray(out.sources)) {
    issues.push('sources 必须全部是字符串数组');
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
      summary: (out as ResearchOutput).summary,
      findings: (out as ResearchOutput).findings,
      contradictions: (out as ResearchOutput).contradictions,
      uncertainties: (out as ResearchOutput).uncertainties,
      sources: (out as ResearchOutput).sources,
      confidence: (out as ResearchOutput).confidence,
    },
    issues: [],
  };
}
