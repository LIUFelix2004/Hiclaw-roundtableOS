import type { WriterOutput, WriterSection } from './schema';
import {
  isNumberInRange,
  isStringArray,
  parseJsonObject,
} from '../skill-validator';

export interface WriterValidation {
  pass: boolean;
  output: WriterOutput | null;
  issues: string[];
}

export function validateWriterOutput(raw: string): WriterValidation {
  const issues: string[] = [];
  const { parsed, error } = parseJsonObject(raw);
  if (error) {
    return { pass: false, output: null, issues: [`输出不是合法 JSON: ${error}`] };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { pass: false, output: null, issues: ['输出必须是 JSON 对象'] };
  }

  const out = parsed as Partial<WriterOutput>;
  if (typeof out.title !== 'string' || out.title.trim() === '') {
    issues.push('title 必须是非空字符串');
  }
  if (typeof out.summary !== 'string' || out.summary.trim() === '') {
    issues.push('summary 必须是非空字符串');
  }

  if (!Array.isArray(out.sections)) {
    issues.push('sections 必须是数组');
  } else {
    out.sections.forEach((section, index) => {
      if (typeof section !== 'object' || section === null) {
        issues.push(`sections[${index}] 必须是对象`);
        return;
      }
      const s = section as Partial<WriterSection>;
      if (typeof s.heading !== 'string' || s.heading.trim() === '') {
        issues.push(`sections[${index}].heading 必须是非空字符串`);
      }
      if (typeof s.content !== 'string' || s.content.trim() === '') {
        issues.push(`sections[${index}].content 必须是非空字符串`);
      }
    });
  }

  if (!isStringArray(out.keyMessages)) {
    issues.push('keyMessages 必须全部是字符串数组');
  }
  if (typeof out.riskNote !== 'string' || out.riskNote.trim() === '') {
    issues.push('riskNote 必须是非空字符串');
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
      title: (out as WriterOutput).title,
      summary: (out as WriterOutput).summary,
      sections: (out as WriterOutput).sections,
      keyMessages: (out as WriterOutput).keyMessages,
      riskNote: (out as WriterOutput).riskNote,
      confidence: (out as WriterOutput).confidence,
    },
    issues: [],
  };
}
