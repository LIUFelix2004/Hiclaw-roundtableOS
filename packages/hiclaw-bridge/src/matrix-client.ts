/**
 * Matrix 客户端封装（T1.2）
 *
 * 对接 hiclaw 的 tuwunel Matrix C-S API，为 hiclaw-bridge 提供：
 *  1. 登录（m.login.password，admin 凭据来自 AGENTTEAMS_ADMIN_PASSWORD）
 *  2. 列出房间（joined_rooms）
 *  3. 长轮询同步（sync + since token 增量，断线退避重连）
 *  4. 发送消息（m.room.message，支持 m.mentions 唤醒）
 *  5. 自定义业务事件编解码（hermes.* 事件透传）
 *
 * 实现选择：REST 长轮询（原生 fetch），不引入 matrix-js-sdk 重依赖。
 * 依据：docs/hiclaw-migration/01 §1.4、§1.5、§6 风险#7（发消息三铁律）。
 *
 * 三铁律（01 §6 风险#7，编排服务调用本类发送时必须遵守）：
 *  1. 发送方必须是房间成员（channelPolicy allowlist，非成员发送静默丢弃）；
 *  2. @唤醒必须用全 Matrix ID（@name:matrix-local.agentteams.io:18080）+ m.mentions；
 *  3. 发送后必须读回确认（按 event_id 校验），否则视为未送达进重试。
 */

import { randomUUID } from 'node:crypto';

/** 业务自定义事件类型前缀（区别于 m.* / 其它系统事件） */
export const CUSTOM_EVENT_PREFIX = 'hermes.';

// ───────────────────────────── 类型 ─────────────────────────────

/** Matrix 原始事件（C-S API 返回的裸结构，字段用下划线，与 Matrix 规范一致） */
export interface MatrixRawEvent {
  type: string;
  event_id: string;
  sender: string;
  origin_server_ts?: number;
  content: Record<string, unknown>;
  unsigned?: Record<string, unknown>;
}

/** 房间消息事件（type = m.room.message） */
export interface MatrixRoomMessage {
  roomId: string;
  eventId: string;
  sender: string;
  msgtype: string;
  body: string;
  content: Record<string, unknown>;
  ts?: number;
}

/** 自定义业务事件（type = hermes.*） */
export interface MatrixCustomEvent {
  roomId: string;
  eventId: string;
  sender: string;
  /** 完整事件类型，如 hermes.agent.output */
  eventType: string;
  /** 去掉前缀后的业务名，如 agent.output */
  name: string;
  content: Record<string, unknown>;
  ts?: number;
}

export interface SendResult {
  eventId: string;
}

export interface SyncHandlers {
  onRoomMessage?: (msg: MatrixRoomMessage) => void;
  onCustomEvent?: (evt: MatrixCustomEvent) => void;
  onAnyEvent?: (evt: MatrixRawEvent & { roomId: string }) => void;
  onError?: (err: Error) => void;
}

export interface StartSyncOptions {
  /** 起始 since token；缺省用上次已保存的 since（增量） */
  since?: string;
  /** 单次 sync 长轮询时长（ms），服务端会 hold 到有事件或超时返回 */
  timeoutMs?: number;
  signal?: AbortSignal;
  retryBaseMs?: number;
  retryMaxMs?: number;
}

export interface MatrixClientOptions {
  baseUrl: string;
  accessToken: string;
  userId?: string;
  fetchImpl?: typeof fetch;
}

export interface MatrixLoginResult {
  accessToken: string;
  userId: string;
  deviceId: string;
}

// Matrix 原始 sync 响应（仅取 join 房间的 timeline）
interface RawSyncResponse {
  next_batch: string;
  rooms?: {
    join?: Record<
      string,
      { timeline?: { events?: MatrixRawEvent[]; limited?: boolean; prev_batch?: string } }
    >;
  };
}

/** 规范化后的 sync 响应（对外 camelCase） */
export interface MatrixSyncResponse {
  nextBatch: string;
  rooms: {
    join: Record<
      string,
      { timeline: { events: MatrixRawEvent[]; limited?: boolean; prevBatch?: string } }
    >;
  };
}

// ───────────────────────────── 工具函数 ─────────────────────────────

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function normalizeSync(raw: RawSyncResponse): MatrixSyncResponse {
  const join: MatrixSyncResponse['rooms']['join'] = {};
  for (const [roomId, room] of Object.entries(raw.rooms?.join ?? {})) {
    join[roomId] = {
      timeline: {
        events: room.timeline?.events ?? [],
        limited: room.timeline?.limited,
        prevBatch: room.timeline?.prev_batch,
      },
    };
  }
  return { nextBatch: raw.next_batch, rooms: { join } };
}

/** 解析自定义业务事件：剥离前缀得 name，content 原样透传 */
export function decodeCustomEvent(roomId: string, evt: MatrixRawEvent): MatrixCustomEvent {
  const name = evt.type.startsWith(CUSTOM_EVENT_PREFIX)
    ? evt.type.slice(CUSTOM_EVENT_PREFIX.length)
    : evt.type;
  return {
    roomId,
    eventId: evt.event_id,
    sender: evt.sender,
    eventType: evt.type,
    name,
    content: evt.content ?? {},
    ts: evt.origin_server_ts,
  };
}

/** 判断事件是否为自定义业务事件 */
export function isCustomEvent(evt: MatrixRawEvent): boolean {
  return evt.type.startsWith(CUSTOM_EVENT_PREFIX);
}

// ───────────────────────────── 客户端 ─────────────────────────────

export class MatrixClient {
  readonly baseUrl: string;
  readonly accessToken: string;
  readonly userId: string;
  private readonly fetchImpl: typeof fetch;
  private sinceToken?: string;

  constructor(opts: MatrixClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.accessToken = opts.accessToken;
    this.userId = opts.userId ?? '';
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  /** 密码登录并返回已就绪的客户端 */
  static async login(
    baseUrl: string,
    user: string,
    password: string,
    fetchImpl?: typeof fetch,
  ): Promise<MatrixClient> {
    const f = fetchImpl ?? fetch;
    const res = await f(`${baseUrl.replace(/\/+$/, '')}/_matrix/client/v3/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'm.login.password',
        identifier: { type: 'm.id.user', user },
        password,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      user_id?: string;
      device_id?: string;
      errcode?: string;
      error?: string;
    };
    if (!res.ok || !data.access_token) {
      const reason = data.errcode ?? data.error ?? `HTTP ${res.status}`;
      throw new Error(`Matrix login failed: ${reason}`);
    }
    return new MatrixClient({
      baseUrl,
      accessToken: data.access_token,
      userId: data.user_id ?? '',
      fetchImpl: f,
    });
  }

  private get authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.accessToken}` };
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...this.authHeaders, ...(init.headers ?? {}) },
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const reason =
        data && typeof data === 'object'
          ? String(
              (data as { errcode?: string; error?: string }).errcode ??
                (data as { errcode?: string; error?: string }).error ??
                JSON.stringify(data),
            )
          : String(data ?? res.statusText);
      throw new Error(`Matrix ${init.method ?? 'GET'} ${path} failed (${res.status}): ${reason}`);
    }
    return data as T;
  }

  /** 当前身份信息（验收/排查用） */
  async whoami(): Promise<{ userId: string; deviceId: string }> {
    const data = await this.request<{ user_id: string; device_id?: string }>(
      '/_matrix/client/v3/account/whoami',
    );
    return { userId: data.user_id, deviceId: data.device_id ?? '' };
  }

  /** 列出已加入的房间 ID 列表 */
  async joinedRooms(): Promise<string[]> {
    const data = await this.request<{ joined_rooms?: string[] }>(
      '/_matrix/client/v3/joined_rooms',
    );
    return data.joined_rooms ?? [];
  }

  /** 单次 sync（长轮询），since 缺省时做初始全量同步 */
  async sync(since?: string, timeoutMs = 30_000): Promise<MatrixSyncResponse> {
    const params = new URLSearchParams({ timeout: String(timeoutMs) });
    if (since) params.set('since', since);
    // 客户端兜底超时 = 服务端 hold 时长 + 缓冲，避免 fetch 先断
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs + 10_000);
    try {
      const raw = await this.request<RawSyncResponse>(
        `/_matrix/client/v3/sync?${params.toString()}`,
        { signal: controller.signal },
      );
      const resp = normalizeSync(raw);
      if (resp.nextBatch) this.sinceToken = resp.nextBatch;
      return resp;
    } finally {
      clearTimeout(timer);
    }
  }

  /** 发送房间文本消息（默认 m.text，可选 m.notice 及 @mention 唤醒） */
  async sendMessage(
    roomId: string,
    body: string,
    opts?: { msgtype?: 'm.text' | 'm.notice'; mentions?: string[]; extra?: Record<string, unknown> },
  ): Promise<SendResult> {
    const content: Record<string, unknown> = {
      msgtype: opts?.msgtype ?? 'm.text',
      body,
      ...(opts?.extra ?? {}),
    };
    if (opts?.mentions?.length) {
      // 铁律#2：@唤醒必须带 m.mentions（user_ids 为全 Matrix ID）
      content['m.mentions'] = { user_ids: opts.mentions };
    }
    return this.sendRawEvent(roomId, 'm.room.message', content);
  }

  /** 发送自定义业务事件（type 建议带 hermes. 前缀，见 CUSTOM_EVENT_PREFIX） */
  async sendCustomEvent(
    roomId: string,
    type: string,
    content: Record<string, unknown>,
  ): Promise<SendResult> {
    return this.sendRawEvent(roomId, type, content);
  }

  /** 底层事件发送（PUT /send/{type}/{txnId}，txnId 保证幂等） */
  private async sendRawEvent(
    roomId: string,
    type: string,
    content: Record<string, unknown>,
  ): Promise<SendResult> {
    const txnId = `hermes-${randomUUID()}`;
    const path = `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/${encodeURIComponent(type)}/${txnId}`;
    const data = await this.request<{ event_id: string }>(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content),
    });
    return { eventId: data.event_id };
  }

  /** 读回某房间最近事件，用于发消息后按 event_id 确认送达（铁律#3） */
  async readBack(roomId: string, limit = 20): Promise<MatrixRawEvent[]> {
    const params = new URLSearchParams({ dir: 'b', limit: String(limit) });
    const data = await this.request<{ chunk?: MatrixRawEvent[] }>(
      `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?${params.toString()}`,
    );
    return data.chunk ?? [];
  }

  /** 当前持有的 since token（可外部持久化，重连时回填） */
  getSinceToken(): string | undefined {
    return this.sinceToken;
  }

  setSinceToken(since: string): void {
    this.sinceToken = since;
  }

  /**
   * 长轮询循环：持续 sync，用 since 增量拉取，断线指数退避重连。
   * 返回仅在 signal 触发 abort 后 resolve；异常经 onError 回调透出。
   */
  async startSync(handlers: SyncHandlers, opts: StartSyncOptions = {}): Promise<void> {
    let since = opts.since ?? this.sinceToken;
    const timeoutMs = opts.timeoutMs ?? 30_000;
    const retryBase = opts.retryBaseMs ?? 1_000;
    const retryMax = opts.retryMaxMs ?? 30_000;
    let attempt = 0;

    while (!opts.signal?.aborted) {
      try {
        const resp = await this.sync(since, timeoutMs);
        since = resp.nextBatch;
        this.sinceToken = resp.nextBatch;
        attempt = 0;

        for (const [roomId, room] of Object.entries(resp.rooms.join)) {
          for (const evt of room.timeline.events) {
            handlers.onAnyEvent?.({ ...evt, roomId });
            if (evt.type === 'm.room.message') {
              const content = evt.content ?? {};
              handlers.onRoomMessage?.({
                roomId,
                eventId: evt.event_id,
                sender: evt.sender,
                msgtype: String(content.msgtype ?? 'm.text'),
                body: String(content.body ?? ''),
                content,
                ts: evt.origin_server_ts,
              });
            } else if (isCustomEvent(evt)) {
              handlers.onCustomEvent?.(decodeCustomEvent(roomId, evt));
            }
          }
        }
      } catch (err) {
        handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
        const delay = Math.min(retryMax, retryBase * 2 ** attempt);
        attempt += 1;
        await sleep(delay, opts.signal);
      }
    }
  }
}
