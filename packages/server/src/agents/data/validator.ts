import type { DataOutput, DataPoint } from './schema';
import {
  isNumberInRange,
  isStringArray,
  parseJsonObject,
} from '../skill-validator';

export interface DataValidation {
  pass: boolean;
  output: DataOutput | null;
  issues: string[];
}

export function validateDataOutput(raw: string): DataValidation {
  const issues: string[] = [];
  const { parsed, error } = parseJsonObject(raw);
  if (error) {
    return { pass: false, output: null, issues: [`输出不是合法 JSON: ${error}`] };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { pass: false, output: null, issues: ['输出必须是 JSON 对象'] };
  }

  const out = parsed as Partial<DataOutput>;
  if (typeof out.summary !== 'string' || out.summary.trim() === '') {
    issues.push('summary 必须是非空字符串');
  }

  if (!Array.isArray(out.dataPoints)) {
    issues.push('dataPoints 必须是数组');
  } else {
    out.dataPoints.forEach((dp, index) => {
      if (typeof dp !== 'object' || dp === null) {
        issues.push(`dataPoints[${index}] 必须是对象`);
        return;
      }
      const point = dp as Partial<DataPoint>;
      if (typeof point.metric !== 'string' || point.metric.trim() === '') {
        issues.push(`dataPoints[${index}].metric 必须是非空字符串`);
      }
      if (
        (typeof point.value !== 'string' && typeof point.value !== 'number') ||
        point.value === ''
      ) {
        issues.push(`dataPoints[${index}].value 必须是非空字符串或数字`);
      }
      if (typeof point.source !== 'string' || point.source.trim() === '') {
        issues.push(`dataPoints[${index}].source 必须是非空字符串`);
      }
      if (!isNumberInRange(point.confidence, 0, 1)) {
        issues.push(`dataPoints[${index}].confidence 必须是 0-1 数字`);
      }
    });
  }

  if (!isStringArray(out.dataGaps)) {
    issues.push('dataGaps 必须全部是字符串数组');
  }
  if (!isStringArray(out.assumptions)) {
    issues.push('assumptions 必须全部是字符串数组');
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
      summary: (out as DataOutput).summary,
      dataPoints: (out as DataOutput).dataPoints,
      dataGaps: (out as DataOutput).dataGaps,
      assumptions: (out as DataOutput).assumptions,
      confidence: (out as DataOutput).confidence,
    },
    issues: [],
  };
}
