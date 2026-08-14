import { MatrixClient, type SyncHandlers, type MatrixRoomMessage } from '@hermes/matrix-client';
import type { AgentRole, RoundtableConfig, RoundtableConsensus } from '@hermes/shared';
import { matrixTypeToSharedEvent, sharedToMatrixType, type S2CEventName, type SharedEmit } from './event-mapping';
import type { WorkerDispatcher } from './scheduler';
import { RoundtableRunner } from './roundtable';

export interface OrchestratorOptions {
  /** Matrix 客户端（已登录） */
  client: MatrixClient;
  /** 编排房间 ID（Worker 事件都在此房间流转） */
  roomId: string;
  /** 多 Worker 映射：角色 → 全 Matrix ID（T3.2 DAG 多角色并行） */
  workers?: Partial<Record<AgentRole, string>>;
  /** 单 Worker 直派（T2.1 兼容）：Worker 全 Matrix ID */
  workerUserId?: string;
  /** 单 Worker 对应角色，默认 data */
  workerRole?: AgentRole;
  /** 向上桥接：把 Matrix 房间里的 hermes.* 事件解码后交给 bridge 转发给前端 */
  emit?: SharedEmit;
  /** 调试日志（可选） */
  log?: (message: string) => void;
}

/**
 * 编排器（T1.3 / T2.1 / T3.2）：桥接 shared 事件契约与 Matrix 房间，
 * 并负责向 Worker 远程派发任务。
 *
 * - start()：长轮询 Matrix 房间，把 hermes.* 自定义事件解码为 shared 事件后向上 emit；
 * - publish()：把 shared 事件编码为 hermes.* 自定义事件发布到 Matrix 房间；
 * - dispatchTask()：@mention 唤醒 → 读回确认 → 等待 Worker 文本回复；
 * - dispatch()：WorkerDispatcher 兼容接口，供 TaskScheduler 按角色派发。
 */
interface PendingDispatch {
  workerUserId: string;
  role: AgentRole;
  taskId: string;
  startedAt: number;
  resolve: (body: string) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  emitOutput: boolean;
}

export class Orchestrator implements WorkerDispatcher {
  readonly roomId: string;
  private readonly client: MatrixClient;
  private readonly workers: Map<AgentRole, string>;
  private readonly defaultRole: AgentRole;
  private readonly emit: SharedEmit;
  private readonly log: (message: string) => void;
  private abort: AbortController | null = null;
  private pending = new Map<number, PendingDispatch>();
  private seq = 0;

  constructor(opts: OrchestratorOptions) {
    this.client = opts.client;
    this.roomId = opts.roomId;
    this.emit = opts.emit ?? (() => {});
    this.log = opts.log ?? (() => {});

    if (opts.workers && Object.keys(opts.workers).length > 0) {
      this.workers = new Map(Object.entries(opts.workers) as Array<[AgentRole, string]>);
    } else if (opts.workerUserId) {
      this.workers = new Map([[opts.workerRole ?? 'data', opts.workerUserId]]);
    } else {
      throw new Error('Orchestrator 需要 workers 映射或 workerUserId');
    }
    this.defaultRole = opts.workerRole ?? this.workers.keys().next().value ?? 'data';
  }

  /** 是否正在同步 */
  get running(): boolean {
    return this.abort !== null;
  }

  /** 启动：长轮询 Matrix 房间，把 hermes.* 自定义事件解码后向上桥接 */
  start(): void {
    if (this.abort) return;
    this.abort = new AbortController();
    const handlers: SyncHandlers = {
      onRoomMessage: (msg) => this.handleWorkerReply(msg),
      onCustomEvent: (evt) => {
        if (evt.roomId !== this.roomId) return;
        const shared = matrixTypeToSharedEvent(evt.eventType);
        if (!shared) {
          this.log(`[orchestrator] 忽略非白名单事件 ${evt.eventType}`);
          return;
        }
        this.emit(shared, evt.content as Record<string, unknown>);
      },
      onError: (err) => this.log(`[orchestrator] sync 异常: ${err.message}`),
    };
    void this.client.startSync(handlers, { signal: this.abort.signal });
  }

  /** 停止同步 */
  stop(): void {
    this.abort?.abort();
    this.abort = null;
  }

  /** 把 shared 事件编码为 hermes.* 自定义事件发布到 Matrix 房间，返回 event_id */
  async publish(event: S2CEventName, payload: Record<string, unknown>): Promise<string> {
    const type = sharedToMatrixType(event);
    const { eventId } = await this.client.sendCustomEvent(this.roomId, type, payload);
    return eventId;
  }

  /** WorkerDispatcher 兼容接口：按角色派发任务正文，不 emit（由 scheduler 统一桥接） */
  async dispatch(role: AgentRole, taskId: string, body: string, timeoutMs?: number): Promise<string> {
    return this.dispatchTask(body, { taskId, role, timeoutMs, emitOutput: false });
  }

  /** T4：启动圆桌辩论，复用 RoundtableRunner 远程派发各 participant + moderator 收敛 */
  async runRoundtable(config: RoundtableConfig): Promise<RoundtableConsensus> {
    const runner = new RoundtableRunner({
      dispatch: (task, opts) =>
        this.dispatchTask(task, { taskId: opts?.taskId, role: opts?.role, timeoutMs: opts?.timeoutMs, emitOutput: false }),
      emit: this.emit,
      log: this.log,
    });
    return runner.start(config);
  }

  /**
   * 任务直派 Worker：@mention 唤醒 → 读回确认 → 等待 Worker 文本回复。
   * 结果同时通过 emit('agent:output') 向上桥接，并作为返回值返回。
   */
  async dispatchTask(
    task: string,
    opts?: { taskId?: string; role?: AgentRole; timeoutMs?: number; emitOutput?: boolean },
  ): Promise<string> {
    const role = opts?.role ?? this.defaultRole;
    const workerUserId = this.workers.get(role);
    if (!workerUserId) {
      throw new Error(
        `未配置角色 ${role} 对应的 Worker（可用角色：${[...this.workers.keys()].join(', ')}）`,
      );
    }

    const { eventId } = await this.client.sendMessage(this.roomId, `${workerUserId} ${task}`, {
      mentions: [workerUserId],
    });
    if (!(await this.confirmSent(eventId))) {
      throw new Error('任务消息读回确认失败，视为未送达');
    }
    this.log(`[orchestrator] 任务已送达 ${role}/${workerUserId}（${eventId}），等待回复…`);

    const timeoutMs = opts?.timeoutMs ?? 120_000;
    const emitOutput = opts?.emitOutput ?? true;
    const taskId = opts?.taskId ?? `task-${++this.seq}`;
    const id = ++this.seq;
    const startedAt = Date.now();
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`等待 Worker(${role}) 回复超时（${timeoutMs}ms）`));
      }, timeoutMs);
      this.pending.set(id, {
        workerUserId,
        role,
        taskId,
        startedAt,
        emitOutput,
        resolve: (body) => {
          if (emitOutput) {
            this.emit('agent:output', {
              taskId,
              agent: role,
              content: body,
              tokens: 0,
              cost: 0,
              duration: Date.now() - startedAt,
            });
          }
          resolve(body);
        },
        reject,
        timer,
      });
    });
  }

  /** Worker 文本回复处理：按 sender 匹配最早的未决直派请求并 resolve / emit */
  private handleWorkerReply(msg: MatrixRoomMessage): void {
    if (msg.roomId !== this.roomId) return;

    for (const [id, pd] of this.pending) {
      if (pd.workerUserId !== msg.sender) continue;
      clearTimeout(pd.timer);
      this.pending.delete(id);
      pd.resolve(msg.body);
      return;
    }

    // 无匹配请求：Worker 主动汇报（角色未知，回退 defaultRole 桥接）
    this.emit('agent:output', {
      agent: this.defaultRole,
      content: msg.body,
      tokens: 0,
      cost: 0,
      duration: 0,
    });
  }

  /** 读回确认（铁律#3）：按 event_id 校验消息已入房间时间线 */
  private async confirmSent(eventId: string, tries = 3): Promise<boolean> {
    for (let i = 0; i < tries; i++) {
      const events = await this.client.readBack(this.roomId, 20);
      if (events.some((e) => e.event_id === eventId)) return true;
      await sleep(500);
    }
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
