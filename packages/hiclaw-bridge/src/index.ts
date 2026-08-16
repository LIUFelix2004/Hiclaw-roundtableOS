import Koa from 'koa';
import cors from '@koa/cors';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import type { AgentRole, ClientToServerEvents, RoundtableConfig, ServerToClientEvents } from '@hermes/shared';
import { MatrixClient } from '@hermes/matrix-client';
import {
  DagRunner,
  Orchestrator,
  Planner,
  RoundtableRunner,
  TaskScheduler,
  type SharedEmit,
} from '@hermes/orchestrator';
import { playRoundtable, playTask } from './mock-player';
import { bridgeStats } from './stats';

// bridge 在 shared 契约（迁移期冻结）之上，仅扩展验收用的 echo/heartbeat 事件；
// 业务事件仍 1:1 复刻 @hermes/shared，通过类型 import 强制签名一致。
interface BridgeServerToClientEvents extends ServerToClientEvents {
  'bridge:echo': (data: { message: string; ts: number }) => void;
  'bridge:heartbeat': (data: { ts: number; uptime: number }) => void;
}

type BridgeSocket = Socket<ClientToServerEvents, BridgeServerToClientEvents>;

/**
 * 运行模式。
 *
 * - live：配齐 Matrix 接入信息时，任务经 Orchestrator 派发给远程 Worker（真实 hiclaw 链路）；
 * - mock：缺少接入信息或显式 MOCK_LLM=1 时，由 mock-player 回放与 legacy MOCK_LLM 一致的
 *   事件流 —— 演示不依赖网络，且「同样的输入 → 同样的输出」。
 */
type Mode = 'live' | 'mock';

interface MatrixConfig {
  baseUrl: string;
  roomId: string;
  token?: string;
  userId?: string;
  user?: string;
  password?: string;
  workers?: Partial<Record<AgentRole, string>>;
  workerUserId?: string;
}

/**
 * 读环境变量，接受多个别名。
 *
 * hiclaw 侧下发的凭据用的是 HICLAW_ROOM_ID / HICLAW_ADMIN_PASSWORD 这类命名，
 * 与本包早先约定的 HICLAW_MATRIX_* 不一致。这里两种都认，避免因为改名漏配而
 * 静默退回 mock —— 那种失败最难排查。
 */
function env(...names: string[]): string | undefined {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

function readMatrixConfig(): MatrixConfig | null {
  const baseUrl = env('HICLAW_MATRIX_BASE_URL');
  const roomId = env('HICLAW_MATRIX_ROOM_ID', 'HICLAW_ROOM_ID');
  if (!baseUrl || !roomId) return null;

  const hasCredentials =
    !!env('HICLAW_MATRIX_TOKEN') ||
    (!!env('HICLAW_MATRIX_USER', 'HICLAW_USER') &&
      !!env('HICLAW_MATRIX_PASSWORD', 'HICLAW_ADMIN_PASSWORD'));
  if (!hasCredentials) return null;

  let workers: Partial<Record<AgentRole, string>> | undefined;
  const rawWorkers = env('HICLAW_WORKERS');
  if (rawWorkers) {
    try {
      workers = JSON.parse(rawWorkers) as Partial<Record<AgentRole, string>>;
    } catch (err) {
      console.warn(`[bridge] HICLAW_WORKERS 不是合法 JSON，已忽略：${(err as Error).message}`);
    }
  }

  const workerUserId = env('HICLAW_WORKER_USER_ID');
  // Orchestrator 至少需要 workers 映射或单 Worker 直派其一，否则构造即抛错。
  if (!workers && !workerUserId) return null;

  return {
    baseUrl,
    roomId,
    token: env('HICLAW_MATRIX_TOKEN'),
    userId: env('HICLAW_MATRIX_USER_ID'),
    user: env('HICLAW_MATRIX_USER', 'HICLAW_USER'),
    password: env('HICLAW_MATRIX_PASSWORD', 'HICLAW_ADMIN_PASSWORD'),
    workers,
    workerUserId,
  };
}

const matrixConfig = readMatrixConfig();
const FORCE_MOCK = process.env.MOCK_LLM === '1';
const WANT_LIVE = env('HICLAW_LIVE') === '1';
const MODE: Mode = !FORCE_MOCK && matrixConfig ? 'live' : 'mock';

// 明确要求 live 却落回了 mock，一定要说清楚缺什么，否则很难排查。
if (WANT_LIVE && MODE === 'mock') {
  const missing: string[] = [];
  if (FORCE_MOCK) missing.push('MOCK_LLM=1 强制离线（去掉它）');
  if (!matrixConfig) {
    if (!env('HICLAW_MATRIX_BASE_URL')) missing.push('HICLAW_MATRIX_BASE_URL');
    if (!env('HICLAW_MATRIX_ROOM_ID', 'HICLAW_ROOM_ID')) missing.push('HICLAW_ROOM_ID');
    if (
      !env('HICLAW_MATRIX_TOKEN') &&
      !(env('HICLAW_MATRIX_USER', 'HICLAW_USER') && env('HICLAW_MATRIX_PASSWORD', 'HICLAW_ADMIN_PASSWORD'))
    ) {
      missing.push('HICLAW_MATRIX_TOKEN 或 HICLAW_MATRIX_USER + HICLAW_ADMIN_PASSWORD');
    }
    if (!env('HICLAW_WORKERS') && !env('HICLAW_WORKER_USER_ID')) {
      missing.push('HICLAW_WORKERS 或 HICLAW_WORKER_USER_ID');
    }
  }
  console.warn(
    `[bridge] 已设 HICLAW_LIVE=1 但仍以 mock 启动，缺少：${missing.join('、') || '未知'}`,
  );
}
if (!env('HICLAW_GATEWAY_KEY')) {
  console.warn('[bridge] 未配置 HICLAW_GATEWAY_KEY，Planner 与 Agent 的模型调用会走离线兜底');
}

/**
 * 把 socket 包装成编排层要的 SharedEmit。
 *
 * 事件名与 payload 已经 1:1 沿用 shared 契约（S2CEventName ⊂ ServerToClientEvents），
 * 但 Socket.IO 的 emit 是按事件名逐个重载的，无法用变量事件名调用；这里收敛成一次
 * 显式的宽签名转换，而不是在每个调用点撒 as any。
 */
function makeEmit(socket: BridgeSocket): SharedEmit {
  const raw = socket as unknown as { emit: (event: string, payload: unknown) => void };
  return (event, payload) => {
    // 顺路采集统计，数据只来自真实转发过的事件。
    if (event === 'agent:output') {
      const p = payload as { agent?: string; tokens?: number; cost?: number; model?: string };
      if (p?.agent) bridgeStats.recordOutput(p.agent, p.tokens, p.cost, p.model);
    } else if (event === 'roundtable:consensus') {
      bridgeStats.recordConsensus(payload);
    }
    raw.emit(event, payload);
  };
}

/** 构建一套 live 编排组件；Matrix 登录失败时抛错，由调用方降级处理。 */
async function buildLiveRunners(config: MatrixConfig, emit: SharedEmit) {
  const client = config.token
    ? new MatrixClient({
        baseUrl: config.baseUrl,
        accessToken: config.token,
        userId: config.userId,
      })
    : await MatrixClient.login(config.baseUrl, config.user!, config.password!);

  const orchestrator = new Orchestrator({
    client,
    roomId: config.roomId,
    workers: config.workers,
    workerUserId: config.workerUserId,
    emit,
    log: (m) => console.log(`[orchestrator] ${m}`),
  });

  const scheduler = new TaskScheduler({
    dispatcher: orchestrator,
    emit,
    log: (m) => console.log(`[scheduler] ${m}`),
  });

  const dag = new DagRunner({
    planner: new Planner(),
    scheduler,
    emit,
    log: (m) => console.log(`[dag] ${m}`),
  });

  const roundtable = new RoundtableRunner({
    dispatch: (task, opts) =>
      orchestrator.dispatch(
        opts?.role ?? 'data',
        opts?.taskId ?? `rt_${Date.now()}`,
        task,
        opts?.timeoutMs,
      ),
    emit,
    log: (m) => console.log(`[roundtable] ${m}`),
  });

  return { orchestrator, dag, roundtable };
}

const app = new Koa();
app.use(cors());

app.use(async (ctx) => {
  if (ctx.method !== 'GET') return;

  // studio 仪表盘经 BFF /api/competition/stats 聚合读取 tokens 与 health；
  // 这几个路由缺失时 BFF 会兜底返回 502，仪表盘全空。
  switch (ctx.path) {
    case '/health':
      ctx.body = {
        status: 'ok',
        service: 'hermes-hiclaw-bridge',
        mode: MODE,
        uptime: process.uptime(),
      };
      return;
    case '/api/stats/tokens':
      ctx.body = bridgeStats.getTokens();
      return;
    case '/api/stats/cost':
      ctx.body = bridgeStats.getCost();
      return;
    case '/api/stats/health':
      ctx.body = bridgeStats.getHealth(MODE);
      return;
    case '/api/stats/roundtable':
      ctx.body = bridgeStats.getRoundtable();
      return;
    default:
      return;
  }
});

const httpServer = createServer(app.callback());
const io = new Server<ClientToServerEvents, BridgeServerToClientEvents>(httpServer, {
  cors: { origin: '*' },
  pingTimeout: 600000,
  pingInterval: 25000,
});

io.on('connection', (socket: BridgeSocket) => {
  console.log(`[bridge:connected] ${socket.id} mode=${MODE}`);

  const emit = makeEmit(socket);
  socket.emit('bridge:echo', { message: `hiclaw-bridge connected (${MODE})`, ts: Date.now() });

  const heartbeat = setInterval(() => {
    socket.emit('bridge:heartbeat', { ts: Date.now(), uptime: process.uptime() });
  }, 10_000);

  // live 组件按需构建、连接内复用；构建失败时本次连接降级为 mock，不让演示中断。
  let livePromise: Promise<Awaited<ReturnType<typeof buildLiveRunners>>> | null = null;
  async function runners() {
    if (MODE !== 'live' || !matrixConfig) return null;
    if (!livePromise) livePromise = buildLiveRunners(matrixConfig, emit);
    try {
      return await livePromise;
    } catch (err) {
      console.warn(`[bridge] live 构建失败，本次连接降级 mock: ${(err as Error).message}`);
      livePromise = null;
      return null;
    }
  }

  socket.on('task:create', async (data) => {
    const message = data?.message ?? '';
    console.log(`[bridge:task:create] "${message}" from ${socket.id}`);
    bridgeStats.activeTasks += 1;
    try {
      const live = await runners();
      if (live) {
        await live.dag.run(message);
      } else {
        await playTask(message, emit as never);
      }
      bridgeStats.recordRun();
    } catch (err) {
      const msg = (err as Error).message || 'task failed';
      console.error(`[bridge:task:create] failed: ${msg}`);
      bridgeStats.recordFailure(msg);
      socket.emit('task:error', { message: msg });
    } finally {
      bridgeStats.activeTasks = Math.max(0, bridgeStats.activeTasks - 1);
    }
  });

  socket.on('roundtable:start', async (data) => {
    const config = data as RoundtableConfig;
    console.log(`[bridge:roundtable:start] topic: ${config?.topic} from ${socket.id}`);
    bridgeStats.activeRoundtables += 1;
    try {
      const live = await runners();
      if (live) {
        await live.roundtable.start(config);
      } else {
        await playRoundtable(config, emit as never);
      }
      bridgeStats.recordRoundtable(config?.topic ?? '', config?.maxRounds ?? 3);
      bridgeStats.recordRun();
    } catch (err) {
      const msg = (err as Error).message || 'roundtable failed';
      console.error(`[bridge:roundtable:start] failed: ${msg}`);
      bridgeStats.recordFailure(msg);
      // 前端（web 与 studio 圆桌 store）靠这个事件复位运行态，失败路径必须发。
      socket.emit('roundtable:error', { message: msg });
    } finally {
      bridgeStats.activeRoundtables = Math.max(0, bridgeStats.activeRoundtables - 1);
    }
  });

  socket.on('rollback:respond', (data) => {
    console.log(`[bridge:rollback:respond] ${data.taskId} -> ${data.action} from ${socket.id}`);
    // 治理链路（Validator / Rollback）属 T5，编排层尚未接入；先如实回执，不伪造恢复结果。
    socket.emit('bridge:echo', {
      message: `rollback:respond received: ${data.taskId}:${data.action}`,
      ts: Date.now(),
    });
  });

  socket.on('disconnect', (reason) => {
    console.log(`[bridge:disconnected] ${socket.id} reason=${reason}`);
    clearInterval(heartbeat);
  });
});

// 默认 8650，避开 legacy server(8648) 与 hermes-agent 平台(8649) 的占用。
const PORT = Number(process.env.HICLAW_BRIDGE_PORT || process.env.PORT || 8650);
httpServer.listen(PORT, () => {
  console.log(`Hermes hiclaw-bridge running on http://localhost:${PORT} (mode=${MODE})`);
});
