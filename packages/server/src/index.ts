import Koa from 'koa';
import cors from '@koa/cors';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import 'dotenv/config';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  AgentRole,
  SubTask,
} from '@hermes/shared';
import { Planner } from './planner';
import { TaskScheduler } from './scheduler';
import type { ExecutionContext } from './types';
import { isMockEnabled } from './llm';
import { RoundtableEngine } from './roundtable-engine';
import type { SkillAgent } from './agents/skill-agent';
import { statsService } from './stats';
import { NEW_ENERGY_PROMPTS, NEW_ENERGY_DATASET } from './demo/new-energy';

const app = new Koa();
app.use(cors());

app.use(async (ctx, next) => {
  if (ctx.method === 'GET') {
    switch (ctx.path) {
      case '/health':
        ctx.body = {
          status: 'ok',
          service: 'hermes-agentos-server',
          mock: isMockEnabled(),
          uptime: process.uptime(),
        };
        return;
      case '/api/stats/tokens':
        ctx.body = statsService.getTokens();
        return;
      case '/api/stats/cost':
        ctx.body = statsService.getCost();
        return;
      case '/api/stats/health':
        ctx.body = statsService.getHealth({
          activeTasks: activeTasks.size,
          activeRoundtables: activeRoundtables.size,
        });
        return;
      case '/api/stats/roundtable':
        ctx.body = statsService.getRoundtable();
        return;
      case '/api/demo':
        ctx.body = {
          prompts: NEW_ENERGY_PROMPTS,
          dataset: NEW_ENERGY_DATASET,
        };
        return;
    }
  }
  await next();
});

const httpServer = createServer(app.callback());
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: '*' },
});

const planner = new Planner();
const scheduler = new TaskScheduler();

const participants = new Map<AgentRole, SkillAgent<any>>();
for (const role of ['data', 'research', 'analyst', 'writer'] as const) {
  const agent = scheduler.getAgent(role);
  if (agent) participants.set(role, agent as SkillAgent<any>);
}
const roundtableEngine = new RoundtableEngine(participants);

// Map socket to active task to prevent duplicate execution
const activeTasks = new Map<string, string>();
const activeRoundtables = new Map<string, string>();

io.on('connection', (socket: Socket) => {
  console.log(`[connected] ${socket.id}`);

  // ── task:create ──
  socket.on('task:create', async (data) => {
    console.log(`[task:create] "${data.message}" from ${socket.id}`);

    // Prevent duplicate
    if (activeTasks.has(socket.id)) {
      statsService.observe('error', {
        message: 'A task is already running for this connection.',
      });
      socket.emit('error', {
        message: `A task is already running for this connection. Wait for it to complete.`,
      });
      return;
    }

    const taskId = `task_${Date.now()}`;
    activeTasks.set(socket.id, taskId);

    const ctx: ExecutionContext = {
      socketId: socket.id,
      emit: (event, payload) => {
        statsService.observe(event, payload);
        (socket as any).emit(event, payload);
      },
    };

    try {
      // 1. Planner decomposes the message
      const plan = planner.plan(data.message);
      console.log(`[planner] ${plan.tasks.length} subtasks:`, plan.reasoning);

      // 2. Emit plan to client
      socket.emit('task:plan', { tasks: plan.tasks });

      // 3. Scheduler executes the DAG
      const results = await scheduler.execute(plan.tasks, data.message, ctx);

      // 4. Emit final summary
      const summary = results
        .map((r) => `[${r.role}] ${r.output.slice(0, 300)}${r.output.length > 300 ? '...' : ''}`)
        .join('\n\n---\n\n');
      socket.emit('agent:output', {
        taskId,
        agent: 'writer' as any,
        content: `## Task Complete\n\n${summary}`,
        tokens: results.reduce((s, r) => s + r.tokens, 0),
        cost: results.reduce((s, r) => s + r.cost, 0),
        duration: results.reduce((s, r) => s + r.duration, 0),
      });
    } catch (err: any) {
      console.error(`[task:create] error:`, err);
      statsService.observe('error', { message: err?.message ?? String(err) });
      socket.emit('error', { message: `Task failed: ${err.message}` });
    } finally {
      activeTasks.delete(socket.id);
    }
  });

  // ── roundtable:start ──
  socket.on('roundtable:start', async (data) => {
    console.log(`[roundtable:start] topic: ${data.topic}`);

    if (activeRoundtables.has(socket.id)) {
      statsService.observe('error', {
        message: 'A roundtable is already running for this connection.',
      });
      socket.emit('error', {
        message: 'A roundtable is already running for this connection.',
      });
      return;
    }

    activeRoundtables.set(socket.id, `rt_${Date.now()}`);
    const ctx: ExecutionContext = {
      socketId: socket.id,
      emit: (event, payload) => {
        statsService.observe(event, payload);
        (socket as any).emit(event, payload);
      },
    };

    try {
      await roundtableEngine.start(data, ctx);
    } catch (err: any) {
      console.error(`[roundtable:start] error:`, err);
      statsService.observe('error', { message: err?.message ?? String(err) });
      socket.emit('error', { message: `Roundtable failed: ${err.message}` });
    } finally {
      activeRoundtables.delete(socket.id);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[disconnected] ${socket.id}`);
    activeTasks.delete(socket.id);
    activeRoundtables.delete(socket.id);
  });
});

const PORT = process.env.PORT || 8648;
httpServer.listen(PORT, () => {
  console.log(`Hermes AgentOS server running on http://localhost:${PORT}`);
  console.log(`[llm] mock mode: ${isMockEnabled() ? 'ON (no real model calls)' : 'OFF'}`);
});
