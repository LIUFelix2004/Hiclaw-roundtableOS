import Koa from 'koa';
import cors from '@koa/cors';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@hermes/shared';

// bridge 在 shared 契约（迁移期冻结）之上，仅扩展验收用的 echo/heartbeat 事件；
// 业务事件仍 1:1 复刻 @hermes/shared，通过类型 import 强制签名一致。
interface BridgeServerToClientEvents extends ServerToClientEvents {
  'bridge:echo': (data: { message: string; ts: number }) => void;
  'bridge:heartbeat': (data: { ts: number; uptime: number }) => void;
}

const app = new Koa();
app.use(cors());

app.use(async (ctx) => {
  if (ctx.method === 'GET' && ctx.path === '/health') {
    ctx.body = {
      status: 'ok',
      service: 'hermes-hiclaw-bridge',
      mode: 'echo',
      uptime: process.uptime(),
    };
    return;
  }
});

const httpServer = createServer(app.callback());
const io = new Server<ClientToServerEvents, BridgeServerToClientEvents>(httpServer, {
  cors: { origin: '*' },
  pingTimeout: 600000,
  pingInterval: 25000,
});

io.on('connection', (socket: Socket<ClientToServerEvents, BridgeServerToClientEvents>) => {
  console.log(`[bridge:connected] ${socket.id}`);

  socket.emit('bridge:echo', { message: 'hiclaw-bridge connected', ts: Date.now() });

  const heartbeat = setInterval(() => {
    socket.emit('bridge:heartbeat', { ts: Date.now(), uptime: process.uptime() });
  }, 10_000);

  // ── 复刻 shared C2S 事件（T1.1 为 echo 骨架，后续接入 orchestrator）──
  socket.on('task:create', (data) => {
    console.log(`[bridge:task:create] "${data.message}" from ${socket.id}`);
    socket.emit('bridge:echo', {
      message: `task:create received: ${data.message}`,
      ts: Date.now(),
    });
  });

  socket.on('roundtable:start', (data) => {
    console.log(`[bridge:roundtable:start] topic: ${data.topic} from ${socket.id}`);
    socket.emit('bridge:echo', {
      message: `roundtable:start received: ${data.topic}`,
      ts: Date.now(),
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
  });
});

// 默认 8650，避开 legacy server(8648) 与 hermes-agent 平台(8649) 的占用。
const PORT = Number(process.env.HICLAW_BRIDGE_PORT || process.env.PORT || 8650);
httpServer.listen(PORT, () => {
  console.log(`Hermes hiclaw-bridge running on http://localhost:${PORT}`);
});
