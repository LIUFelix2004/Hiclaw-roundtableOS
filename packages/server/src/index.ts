import Koa from 'koa';
import cors from '@koa/cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import 'dotenv/config';
import type { ClientToServerEvents, ServerToClientEvents } from '@hermes/shared';

const app = new Koa();
app.use(cors());

const httpServer = createServer(app.callback());
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: '*' },
});

io.on('connection', (socket) => {
  console.log(`[connected] ${socket.id}`);

  socket.on('task:create', async (data) => {
    console.log(`[task:create] ${data.message}`);
    // TODO: B implements Planner + Agent scheduling here
    socket.emit('error', { message: 'Not implemented yet - B will build this!' });
  });

  socket.on('roundtable:start', async (data) => {
    console.log(`[roundtable:start] topic: ${data.topic}`);
    // TODO: B implements roundtable engine here
    socket.emit('error', { message: 'Not implemented yet - B will build this!' });
  });

  socket.on('disconnect', () => {
    console.log(`[disconnected] ${socket.id}`);
  });
});

const PORT = process.env.PORT || 8648;
httpServer.listen(PORT, () => {
  console.log(`🚀 Hermes AgentOS server running on http://localhost:${PORT}`);
});
