export function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
  }
  return trimmed;
}

function repairTruncatedJson(json: string): string {
  let s = json.trimEnd();
  // Remove trailing incomplete string value (e.g. truncated mid-value)
  s = s.replace(/,\s*"[^"]*$/, '');
  s = s.replace(/,\s*"[^"]*":\s*"[^"]*$/, '');
  s = s.replace(/,\s*"[^"]*":\s*$/, '');
  // Close any unclosed strings
  const quoteCount = (s.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) s += '"';
  // Close brackets/braces
  const stack: string[] = [];
  let inString = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' && (i === 0 || s[i - 1] !== '\\')) { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{' || c === '[') stack.push(c === '{' ? '}' : ']');
    else if (c === '}' || c === ']') stack.pop();
  }
  // Remove trailing comma before closing
  s = s.replace(/,\s*$/, '');
  while (stack.length) s += stack.pop();
  return s;
}

export function parseJsonObject(raw: string): {
  parsed: unknown;
  error?: string;
} {
  const stripped = stripCodeFence(raw);
  try {
    return { parsed: JSON.parse(stripped) };
  } catch {
    try {
      return { parsed: JSON.parse(repairTruncatedJson(stripped)) };
    } catch (err) {
      return { parsed: null, error: (err as Error).message };
    }
  }
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isNumberInRange(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}
