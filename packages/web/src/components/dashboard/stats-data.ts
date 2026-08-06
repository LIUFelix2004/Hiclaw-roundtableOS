export type DashboardStats = { tokens: unknown; cost: unknown; health: unknown; roundtable: unknown };

export function numberValue(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function records(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['data', 'items', 'history', 'records']) if (Array.isArray(record[key])) return records(record[key]);
  }
  return [];
}
