import type { ClientToServerEvents, ServerToClientEvents } from '@hermes/shared';

/**
 * shared 事件契约 ↔ Matrix 自定义事件（hermes.*）的双向映射（T1.3）。
 *
 * 命名约定：shared 事件名用冒号（task:create），Matrix 事件类型遵循
 * reverse-DNS 约定不能用冒号，统一把 ':' 映射为 '.'，并以 hermes. 前缀
 * 标记为业务自定义事件（与 @hermes/matrix-client 的 CUSTOM_EVENT_PREFIX 一致）。
 */

/** C2S 事件清单（前端 → 后端） */
export const C2S_EVENTS = ['task:create', 'roundtable:start', 'rollback:respond'] as const;
export type C2SEventName = (typeof C2S_EVENTS)[number];

/** S2C 事件清单（后端 → 前端），与 shared ServerToClientEvents 1:1 一致 */
export const S2C_EVENTS = [
  'task:plan',
  'agent:status',
  'agent:output',
  'agent:stream',
  'agent:trace',
  'agent:snapshot',
  'agent:error',
  'validator:result',
  'rollback:start',
  'rollback:complete',
  'rollback:human',
  'memory:updated',
  'roundtable:speech',
  'roundtable:consensus',
  'error',
] as const;
export type S2CEventName = (typeof S2C_EVENTS)[number];

/** 向上桥接事件回调（编排层 → bridge → 前端） */
export type SharedEmit = (event: S2CEventName, payload: Record<string, unknown>) => void;

// 编译期完整性断言：清单必须与 shared 事件契约 1:1 一致（漏写/多写即编译失败）
type SameKeys<A extends readonly string[], B extends readonly string[]> =
  Exclude<A[number], B[number]> extends never
    ? Exclude<B[number], A[number]> extends never
      ? true
      : never
    : never;
type _Assert<T extends true> = T;
type _C2SExact = _Assert<SameKeys<(keyof ClientToServerEvents)[], typeof C2S_EVENTS>>;
type _S2CExact = _Assert<SameKeys<(keyof ServerToClientEvents)[], typeof S2C_EVENTS>>;

/** Matrix 自定义事件前缀（与 @hermes/matrix-client 的 CUSTOM_EVENT_PREFIX 一致） */
const MATRIX_EVENT_PREFIX = 'hermes.';

/**
 * shared 事件名（冒号分隔）→ Matrix 自定义事件类型（hermes. 前缀 + 点号分隔）。
 * 例：'agent:output' → 'hermes.agent.output'
 */
export function sharedToMatrixType(event: string): string {
  return `${MATRIX_EVENT_PREFIX}${event.replace(/:/g, '.')}`;
}

/**
 * Matrix 自定义事件类型（hermes.*）→ shared 事件名；非 S2C 白名单返回 null。
 * 例：'hermes.agent.output' → 'agent:output'
 */
export function matrixTypeToSharedEvent(eventType: string): S2CEventName | null {
  if (!eventType.startsWith(MATRIX_EVENT_PREFIX)) return null;
  const raw = eventType.slice(MATRIX_EVENT_PREFIX.length).replace(/\./g, ':');
  return (S2C_EVENTS as readonly string[]).includes(raw) ? (raw as S2CEventName) : null;
}
