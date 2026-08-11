/**
 * Full-chain integration test over the real Socket.IO + Koa entry point.
 *
 * Starts packages/server/src/index.ts in-process, then drives the same
 * wire protocol the web client uses: DAG task, AI roundtable, rollback
 * interception, plus REST health/stats checks.
 *
 * Run with: pnpm --filter @hermes/server integration-test
 */
import { io, type Socket } from 'socket.io-client';
import type {
  AgentOutput,
  AgentStatus,
  ClientToServerEvents,
  RoundtableConsensus,
  ServerToClientEvents,
  SubTask,
} from '@hermes/shared';

process.env.MOCK_LLM = '1';
process.env.PORT = process.env.INTEGRATION_PORT || '8649';
const PORT = Number(process.env.PORT);

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  PASS: ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForEvent<K extends keyof ServerToClientEvents>(
  socket: Socket<ServerToClientEvents, ClientToServerEvents>,
  event: K,
  predicate: (data: Parameters<ServerToClientEvents[K]>[0]) => boolean,
  timeoutMs: number,
): Promise<Parameters<ServerToClientEvents[K]>[0]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler as never);
      reject(new Error(`timeout waiting for ${String(event)}`));
    }, timeoutMs);
    const handler = (...args: Parameters<ServerToClientEvents[K]>) => {
      const data = args[0] as Parameters<ServerToClientEvents[K]>[0];
      if (!predicate(data)) return;
      clearTimeout(timer);
      socket.off(event, handler as never);
      resolve(data);
    };
    socket.on(event, handler as never);
  });
}

async function main(): Promise<void> {
  await import('./index');
  await sleep(600);

  const socket = io(`http://localhost:${PORT}`, {
    transports: ['websocket'],
    forceNew: true,
    timeout: 5000,
  });
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', (err) => reject(err));
  });
  assert(socket.connected, 'Socket.IO client should connect to the real server');

  const seen = new Set<string>();
  const statuses: AgentStatus[] = [];
  let streamChunks = 0;
  let validatorResults = 0;
  let memoryUpdates = 0;
  let rollbackStarts = 0;
  socket.onAny((event, payload) => {
    seen.add(event);
    if (event === 'agent:status') statuses.push(payload as AgentStatus);
    if (event === 'agent:stream') streamChunks += 1;
    if (event === 'validator:result') validatorResults += 1;
    if (event === 'memory:updated') memoryUpdates += 1;
    if (event === 'rollback:start') rollbackStarts += 1;
  });

  // ── REST checks ──
  console.log('\n=== REST Health & Stats ===');
  const health = await (await fetch(`http://localhost:${PORT}/health`)).json();
  assert(health.status === 'ok' && health.mock === true, '/health should report ok + mock mode');
  const tokens = await (await fetch(`http://localhost:${PORT}/api/stats/tokens`)).json();
  assert(typeof tokens.total === 'number', '/api/stats/tokens should return a numeric total');
  const statsHealth = await (await fetch(`http://localhost:${PORT}/api/stats/health`)).json();
  assert(statsHealth.status === 'ok', '/api/stats/health should report ok');

  // ── 1. DAG collaboration ──
  console.log('\n=== 1. DAG Collaboration (task:create) ===');
  const planPromise = waitForEvent(socket, 'task:plan', (data) => data.tasks.length > 0, 30000);
  const summaryPromise = waitForEvent(
    socket,
    'agent:output',
    (data) => data.content.startsWith('## Task Complete'),
    120000,
  );
  socket.emit('task:create', {
    message: '生成一份新能源行业战略分析周报，包含储能、光伏和新能源车',
  });
  const plan = await planPromise;
  assert(plan.tasks.length >= 3, `Planner should produce >=3 subtasks, got ${plan.tasks.length}`);
  assert(typeof plan.reasoning === 'string' && plan.reasoning.length > 0, 'task:plan should include reasoning');
  const roles = new Set(plan.tasks.map((task: SubTask) => task.agent));
  assert(roles.has('analyst') && roles.has('writer'), 'DAG should include analyst and writer');

  const summary = await summaryPromise;
  assert(summary.tokens > 0, 'Final summary should report token usage');
  assert(summary.cost >= 0, 'Final summary should report cost');
  assert(seen.has('agent:stream') && streamChunks > 0, 'agent:stream should stream output');
  assert(seen.has('agent:trace'), 'agent:trace should be emitted');
  assert(seen.has('agent:snapshot'), 'agent:snapshot should be emitted');
  assert(validatorResults > 0, 'validator:result should be emitted');
  assert(memoryUpdates > 0, 'memory:updated should be emitted');
  assert(
    statuses.some((s) => s.status === 'running') && statuses.some((s) => s.status === 'success'),
    'agent:status should track running -> success',
  );
  await sleep(400);

  // ── 2. AI Roundtable ──
  console.log('\n=== 2. AI Roundtable (roundtable:start) ===');
  const speechPromise = waitForEvent(
    socket,
    'roundtable:speech',
    (data) => data.round > 0,
    60000,
  );
  const consensusPromise = waitForEvent(socket, 'roundtable:consensus', () => true, 180000);
  socket.emit('roundtable:start', {
    topic: '新能源企业应该优先布局储能还是光伏？',
    agents: ['data', 'research', 'analyst', 'writer'],
    maxRounds: 1,
  });
  const speech = await speechPromise;
  assert(speech.content.length > 0, 'Roundtable should stream participant speech');
  const consensus = (await consensusPromise) as RoundtableConsensus;
  assert(consensus.rounds >= 1, 'Roundtable should complete at least 1 round');
  assert(
    typeof consensus.finalAnswer === 'string' && consensus.finalAnswer.length > 0,
    'Roundtable consensus should include finalAnswer',
  );
  assert(
    Array.isArray(consensus.executionTasks) && consensus.executionTasks.length > 0,
    'Roundtable consensus should include executionTasks',
  );
  await sleep(400);

  // ── 3. Fault recovery interception ──
  console.log('\n=== 3. Fault Recovery (FAIL_INJECT + rollback) ===');
  const rollbackStartPromise = waitForEvent(socket, 'rollback:start', () => true, 60000);
  const errorPromise = waitForEvent(
    socket,
    'error',
    (data) => data.message.includes('Validator 拦截') || data.message.includes('Task failed'),
    90000,
  );
  socket.emit('task:create', { message: '收集数据 FAIL_INJECT' });
  const rollbackStart = await rollbackStartPromise;
  assert(rollbackStart.taskId.length > 0, 'rollback:start should carry the failed taskId');
  const taskError = await errorPromise;
  assert(taskError.message.length > 0, 'Scheduler should emit a task failure for unrecovered output');
  assert(rollbackStarts >= 1, 'rollback:start should be emitted during fault recovery');
  assert(
    seen.has('rollback:complete') || seen.has('rollback:human'),
    'rollback should complete or escalate after interception',
  );

  socket.disconnect();
  console.log('\n=== Full-chain integration passed ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL: full-chain integration error:', err);
  process.exit(1);
});
