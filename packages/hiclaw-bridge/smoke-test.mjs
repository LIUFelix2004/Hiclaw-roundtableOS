/**
 * hiclaw-bridge 冒烟测试：按 hermes-studio 圆桌 store 的真实调用方式驱动 bridge，
 * 验证「studio 前端 ←→ hiclaw 后端」这条链路的事件契约是通的。
 *
 *   node packages/hiclaw-bridge/smoke-test.mjs
 *
 * 需要 bridge 已在 8650 运行（mock 模式即可）。
 */
import { io } from 'socket.io-client';

const URL = process.env.BRIDGE_URL || 'http://127.0.0.1:8650';
const socket = io(URL, { transports: ['websocket'], reconnection: false });

const seen = { speeches: [], consensus: null, statuses: [], outputs: [], plan: null, errors: [] };

// studio competition-roundtable.ts 监听的事件集合
socket.on('roundtable:speech', (d) => seen.speeches.push(d));
socket.on('roundtable:consensus', (d) => { seen.consensus = d; });
socket.on('agent:status', (d) => seen.statuses.push(d));
socket.on('agent:output', (d) => seen.outputs.push(d));
socket.on('roundtable:error', (d) => seen.errors.push(['roundtable:error', d]));
socket.on('task:error', (d) => seen.errors.push(['task:error', d]));
socket.on('task:plan', (d) => { seen.plan = d; });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (c, m) => console.log(`${c ? '  PASS' : '  FAIL'}  ${m}`);
let failed = 0;
const check = (c, m) => { if (!c) failed++; ok(c, m); };

socket.on('connect', async () => {
  console.log(`connected: ${socket.id}\n`);

  // ── 1. 圆桌：studio 发的就是这个 payload 形状 ──────────────────────
  console.log('[1] roundtable:start  {topic, agents, maxRounds}');
  socket.emit('roundtable:start', {
    topic: '新能源汽车出海的主要风险',
    agents: ['research', 'analyst', 'writer', 'validator'],
    maxRounds: 2,
  });
  await wait(40000);

  check(seen.speeches.length > 0, `收到 roundtable:speech × ${seen.speeches.length}`);
  check(!!seen.consensus, ' 收到 roundtable:consensus');
  const s0 = seen.speeches[0] || {};
  check(
    typeof s0.round === 'number' && !!s0.agent && !!s0.stance && !!s0.content,
    'speech 字段齐全 (round/agent/stance/content) — studio addSpeech 可直接消费',
  );
  const hasSynth = seen.speeches.some((s) => s.stance === 'synthesize');
  check(hasSynth, ' 存在 stance=synthesize 的收敛发言 — studio 靠它把 phase 置为 done');
  check(seen.statuses.length > 0, `收到 agent:status × ${seen.statuses.length} — 驱动 3D 场景 thinkingAgent`);
  check(seen.outputs.some((o) => typeof o.tokens === 'number'), 'agent:output 带 tokens — 驱动 totalTokens 累加');

  // ── 2. DAG 任务 ────────────────────────────────────────────────
  console.log('\n[2] task:create');
  seen.outputs.length = 0;
  socket.emit('task:create', { message: '分析新能源汽车出海机会' });
  await wait(30000);
  check(!!seen.plan, ' 收到 task:plan');
  check(Array.isArray(seen.plan?.tasks) && seen.plan.tasks.length > 0, `task:plan.tasks × ${seen.plan?.tasks?.length ?? 0}`);
  check(seen.outputs.length > 0, `收到 agent:output × ${seen.outputs.length}`);

  // ── 3. 失败路径：前端靠 roundtable:error 复位运行态 ──────────────
  console.log('\n[3] 失败路径 roundtable:error（非法 payload）');
  seen.errors.length = 0;
  socket.emit('roundtable:start', null);
  await wait(2500);
  check(
    seen.errors.some(([e]) => e === 'roundtable:error'),
    ' 非法输入触发 roundtable:error（而不是静默卡死）',
  );

  console.log(`\n${failed === 0 ? 'ALL PASS' : failed + ' FAILED'}`);
  socket.close();
  process.exit(failed === 0 ? 0 : 1);
});

socket.on('connect_error', (e) => {
  console.error('连接失败：', e.message, '— bridge 起了吗？');
  process.exit(1);
});
