import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@hermes/shared';

// 后端模式：hiclaw（适配桥）或 legacy（原 packages/server），默认 legacy 保持原行为。
const BACKEND = process.env.NEXT_PUBLIC_BACKEND === 'hiclaw' ? 'hiclaw' : 'legacy';

const DEFAULT_URL: Record<'hiclaw' | 'legacy', string> = {
  hiclaw: 'http://localhost:8650',
  legacy: 'http://localhost:8648',
};

const SERVER_URL =
  (BACKEND === 'hiclaw'
    ? process.env.NEXT_PUBLIC_BRIDGE_URL
    : process.env.NEXT_PUBLIC_SERVER_URL) || DEFAULT_URL[BACKEND];

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: true,
      reconnection: true,
      // 无限重连：后端短暂不可用（如重启 bridge/dev server）后旧标签页的
      // socket 不能永久死亡，否则 emit 被静默缓冲、前端空等（"卡死"类问题）。
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return socket;
}
