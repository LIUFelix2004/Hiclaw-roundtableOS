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
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}
