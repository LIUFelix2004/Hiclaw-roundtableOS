import Koa from 'koa';
import cors from '@koa/cors';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import type { AgentRole, ClientToServerEvents, ServerToClientEvents } from '@hermes/shared';
import { MatrixClient } from '@hermes/matrix-client';
import { Orchestrator, Planner, TaskScheduler, DagRunner, statsService } from '@hermes/orchestrator';
import { playTask, playRoundtable, type EmitFn } from './mock-player';

// bridge 在 shared 契约（迁移期冻结）之上，仅扩展验收用的 echo/heartbeat 事件；
// 业务事件仍 1:1 复刻 @hermes/shared，通过类型 import 强制签名一致。
interface BridgeServerToClientEvents extends ServerToClientEvents {
  'bridge:echo': (data: { message: string; ts: number }) => void;
  'bridge:heartbeat': (data: { ts: number; uptime: number }) => void;
}

// ── live 模式（真实 orchestrator 联调）────────────────────────────
// HICLAW_LIVE=1 时走真实链路：Matrix 登录 → Orchestrator 长轮询 →
// Planner/Scheduler/DagRunner 远程派发 Worker；未设置则保持 mock-player 回放（默认）。
interface LiveContext {
  orchestrator: Orchestrator;
  dagRunner: DagRunner;
}

function parseWorkers(): Partial<Record<AgentRole, string>> {
  const raw = process.env.HICLAW_WORKERS;
  if (raw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('HICLAW_WORKERS 不是合法 JSON');
    }
    if (parsed && typeof parsed === 'object') {
      return parsed as Partial<Record<AgentRole, string>>;
    }
  }
  const workerUserId = process.env.HICLAW_WORKER_USER_ID;
  if (workerUserId) {
    const role = (process.env.HICLAW_WORKER_ROLE || 'data') as AgentRole;
    return { [role]: workerUserId } as Partial<Record<AgentRole, string>>;
  }
  throw new Error('HICLAW_LIVE=1 但未配置 HICLAW_WORKERS 或 HICLAW_WORKER_USER_ID');
}

async function resolveLiveContext(emitToAll: EmitFn): Promise<LiveContext | null> {
  if (process.env.HICLAW_LIVE !== '1') return null;

  const baseUrl = (process.env.HICLAW_MATRIX_BASE_URL || 'http://127.0.0.1:18080').replace(/\/+$/, '');
  const user = process.env.HICLAW_MATRIX_USER || 'admin';
  const password = process.env.HICLAW_ADMIN_PASSWORD || '';
  const roomId = process.env.HICLAW_ROOM_ID || '';
  if (!password) throw new Error('HICLAW_LIVE=1 但未配置 HICLAW_ADMIN_PASSWORD');
  if (!roomId) throw new Error('HICLAW_LIVE=1 但未配置 HICLAW_ROOM_ID');

  console.log(`[bridge:live] 登录 Matrix ${baseUrl} (user=${user}, room=${roomId}) ...`);
  const client = await MatrixClient.login(baseUrl, user, password);
  console.log(`[bridge:live] Matrix 登录成功 userId=${client.userId}`);

  const log = (msg: string) => console.log(`[bridge:live] ${msg}`);
  const emit = (event: string, payload: unknown) => emitToAll(event, payload);

  const orchestrator = new Orchestrator({
    client,
    roomId,
    workers: parseWorkers(),
    emit,
    log,
  });
  const planner = new Planner();
  const scheduler = new TaskScheduler({ dispatcher: orchestrator, emit, log });
  const dagRunner = new DagRunner({ planner, scheduler, emit, log });

  orchestrator.start();
  console.log(
    `[bridge:live] orchestrator 已启动，workers=${JSON.stringify(parseWorkers())}`,
  );
  return { orchestrator, dagRunner };
}

async function main(): Promise<void> {
  const app = new Koa();
  app.use(cors());

  let live: LiveContext | null = null;
  let activeTaskCount = 0;
  let activeRoundtableCount = 0;

  app.use(async (ctx) => {
    if (ctx.method === 'GET' && ctx.path === '/health') {
      ctx.body = {
        status: 'ok',
        service: 'hermes-hiclaw-bridge',
        mode: live ? 'live-orchestrator' : 'mock-player',
        uptime: process.uptime(),
        activeTasks: activeTaskCount,
        activeRoundtables: activeRoundtableCount,
      };
      return;
    }
    if (ctx.method === 'GET' && ctx.path === '/api/stats/tokens') {
      ctx.body = statsService.getTokens();
      return;
    }
    if (ctx.method === 'GET' && ctx.path === '/api/stats/cost') {
      ctx.body = statsService.getCost();
      return;
    }
    if (ctx.method === 'GET' && ctx.path === '/api/stats/roundtable') {
      ctx.body = statsService.getRoundtable();
      return;
    }
    if (ctx.method === 'GET' && ctx.path === '/api/stats/health') {
      ctx.body = statsService.getHealth({
        activeTasks: activeTaskCount,
        activeRoundtables: activeRoundtableCount,
      });
      return;
    }
  });

  const httpServer = createServer(app.callback());
  const io = new Server<ClientToServerEvents, BridgeServerToClientEvents>(httpServer, {
    cors: { origin: '*' },
    pingTimeout: 600000,
    pingInterval: 25000,
  });

  // live 模式事件流是 Matrix 房间广播语义，统一 io.emit 给所有已连接前端。
  const emitToAll: EmitFn = (event, payload) => {
    statsService.observe(event, payload);
    io.emit(event as keyof BridgeServerToClientEvents, payload as never);
  };

  live = await resolveLiveContext(emitToAll);

  io.on('connection', (socket: Socket<ClientToServerEvents, BridgeServerToClientEvents>) => {
    console.log(`[bridge:connected] ${socket.id}`);

    socket.emit('bridge:echo', { message: 'hiclaw-bridge connected', ts: Date.now() });

    const heartbeat = setInterval(() => {
      socket.emit('bridge:heartbeat', { ts: Date.now(), uptime: process.uptime() });
    }, 10_000);

    // mock 用 per-socket 定向；live 用全局广播（emitToAll）。
    const socketEmit: EmitFn = (event, payload) => {
      statsService.observe(event, payload);
      socket.emit(event as keyof BridgeServerToClientEvents, payload as never);
    };

    // per-socket 并发保护：同一 socket 上同类型回放只允许一个在跑，避免事件流交错。
    const activeTasks = new Set<string>();
    const activeRoundtables = new Set<string>();

    socket.on('task:create', (data) => {
      if (activeTasks.size > 0) {
        console.log(`[bridge:task:create] ignored duplicate from ${socket.id}`);
        return;
      }
      activeTasks.add(socket.id);
      activeTaskCount++;
      console.log(
        `[bridge:task:create] "${data.message}" from ${socket.id} (mode=${live ? 'live' : 'mock'})`,
      );

      const task = live
        ? live.dagRunner.run(data.message)
        : playTask(data.message, socketEmit);

      task
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[bridge:task:error] ${message} from ${socket.id}`);
          (live ? emitToAll : socketEmit)('task:error', { message });
        })
        .finally(() => {
          activeTasks.delete(socket.id);
          activeTaskCount--;
        });
    });

    socket.on('roundtable:start', (data) => {
      if (activeRoundtables.size > 0) {
        console.log(`[bridge:roundtable:start] ignored duplicate from ${socket.id}`);
        return;
      }
      activeRoundtables.add(socket.id);
      activeRoundtableCount++;
      console.log(
        `[bridge:roundtable:start] topic: ${data.topic} from ${socket.id} (mode=${live ? 'live' : 'mock'})`,
      );

      const rt = live
        ? live.orchestrator.runRoundtable(data)
        : playRoundtable(data, socketEmit);

      rt
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[bridge:roundtable:error] ${message} from ${socket.id}`);
          (live ? emitToAll : socketEmit)('roundtable:error', { message });
        })
        .finally(() => {
          activeRoundtables.delete(socket.id);
          activeRoundtableCount--;
        });
    });

    socket.on('rollback:respond', (data) => {
      console.log(`[bridge:rollback:respond] ${data.taskId} -> ${data.action} from ${socket.id}`);
      socket.emit('bridge:echo', {
        message: `rollback:respond received: ${data.taskId}:${data.action}`,
        ts: Date.now(),
      });
    });

    socket.on('disconnect', (reason) => {
      console.log(`[bridge:disconnected] ${socket.id} reason=${reason}`);
      clearInterval(heartbeat);
      activeTasks.clear();
      activeRoundtables.clear();
    });
  });

  // 默认 8650，避开 legacy server(8648) 与 hermes-agent 平台(8649) 的占用。
  const PORT = Number(process.env.HICLAW_BRIDGE_PORT || process.env.PORT || 8650);
  httpServer.listen(PORT, () => {
    console.log(
      `Hermes hiclaw-bridge running on http://localhost:${PORT} (mode=${live ? 'live-orchestrator' : 'mock-player'})`,
    );
  });
}

main().catch((err) => {
  console.error('[bridge:startup]', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
