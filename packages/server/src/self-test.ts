/**
 * Logic self-test: Planner decomposition + Scheduler DAG ordering.
 * 
 * Tests the core scheduling logic without requiring LLM API keys.
 * Run with: npx tsx packages/server/src/self-test.ts
 */
import { Planner } from './planner';
import { TaskScheduler } from './scheduler';
import type { AgentRole, SubTask } from '@hermes/shared';
import { AnalystAgent, DataAgent, ResearchAgent, ValidatorAgent, WriterAgent } from './agents';
import type { SkillAgent } from './agents/skill-agent';
import { RoundtableEngine } from './roundtable-engine';
import { experienceMemory } from './experience-memory';
import { snapshotStore } from './snapshot-store';
import { RollbackEngine } from './rollback-engine';
import { statsService } from './stats';
import { NEW_ENERGY_PROMPTS, NEW_ENERGY_DATASET } from './demo/new-energy';
import os from 'os';
import path from 'path';

process.env.MOCK_LLM = '1';
process.env.HERMES_DATA_DIR = path.join(os.tmpdir(), `hermes-self-test-${Date.now()}`);

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  PASS: ${message}`);
}

// ── Test 1: Planner decomposition ──
console.log('\n=== Test 1: Planner Decomposition ===');

const planner = new Planner();

// Case A: Data + Analysis + Writing
const planA = planner.plan('collect data about market trends and analyze them, then write a report');
assert(planA.tasks.length === 4, `Should have 4 tasks, got ${planA.tasks.length}`);
const rolesA = planA.tasks.map(t => t.agent);
assert(rolesA.includes('data'), 'Should include data agent');
assert(rolesA.includes('analyst'), 'Should include analyst agent');
assert(rolesA.includes('writer'), 'Should include writer agent');

// Case B: Research only
const planB = planner.plan('research the latest AI news');
assert(planB.tasks.length === 1, `Should have 1 task, got ${planB.tasks.length}`);
assert(planB.tasks[0].agent === 'research', 'Should be research agent');

// Case C: Default pipeline (no keywords detected)
const planC = planner.plan('hello world tell me something interesting');
assert(planC.tasks.length === 3, `Default should have 3 tasks, got ${planC.tasks.length}`);
assert(planC.tasks[0].agent === 'research', 'First should be research');
assert(planC.tasks[1].agent === 'analyst', 'Second should be analyst');
assert(planC.tasks[2].agent === 'writer', 'Third should be writer');

// Verify DAG dependencies in default pipeline
assert(planC.tasks[0].dependsOn.length === 0, 'Research should have no deps');
assert(planC.tasks[1].dependsOn.includes(planC.tasks[0].id), 'Analyst should depend on research');
assert(planC.tasks[2].dependsOn.includes(planC.tasks[0].id), 'Writer should depend on research');
assert(planC.tasks[2].dependsOn.includes(planC.tasks[1].id), 'Writer should depend on analyst');

console.log('  Planner: all decomposition tests passed');

// ── Test 2: Scheduler DAG topology ──
console.log('\n=== Test 2: Scheduler DAG Ordering ===');

// Build a simple DAG manually and verify execution order
// A → B, A → C, B → D, C → D
const manualTasks: SubTask[] = [
  { id: 'A', title: 'Step A', agent: 'research', dependsOn: [], status: 'pending' },
  { id: 'B', title: 'Step B', agent: 'data', dependsOn: ['A'], status: 'pending' },
  { id: 'C', title: 'Step C', agent: 'analyst', dependsOn: ['A'], status: 'pending' },
  { id: 'D', title: 'Step D', agent: 'writer', dependsOn: ['B', 'C'], status: 'pending' },
];

// Topological sort levels:
// Level 0: A (no deps)
// Level 1: B, C (depend on A)
// Level 2: D (depends on B, C)
const levels = topologicalLevels(manualTasks);
assert(levels.size === 3, `Should have 3 levels, got ${levels.size}`);
assert(levels.get(0)?.has('A') === true, 'Level 0 should contain A');
assert(levels.get(1)?.has('B') === true && levels.get(1)?.has('C') === true, 'Level 1 should contain B and C');
assert(levels.get(2)?.has('D') === true, 'Level 2 should contain D');

console.log('  Scheduler: DAG topology tests passed');

// ── Test 3: Cycle detection ──
console.log('\n=== Test 3: Cycle Detection ===');

const cycleTasks: SubTask[] = [
  { id: 'X', title: 'Step X', agent: 'research', dependsOn: ['Z'], status: 'pending' },
  { id: 'Y', title: 'Step Y', agent: 'data', dependsOn: ['X'], status: 'pending' },
  { id: 'Z', title: 'Step Z', agent: 'analyst', dependsOn: ['Y'], status: 'pending' },
];

const cycleLevels = topologicalLevels(cycleTasks);
assert(cycleLevels.size === 0, `Cycle DAG should return 0 levels, got ${cycleLevels.size}`);

console.log('  Scheduler: cycle detection passed');

// ── Test 4: Scheduler agent registry ──
console.log('\n=== Test 4: Agent Registry ===');

const scheduler = new TaskScheduler();
const roles = ['data', 'research', 'analyst', 'writer'] as const;
for (const role of roles) {
  const agent = scheduler.getAgent(role);
  assert(agent !== undefined, `Should have agent for role: ${role}`);
  assert(agent!.role === role, `Agent role should match: ${role}`);
}

console.log('  Scheduler: agent registry passed');

// ── Test 5: Chinese task decomposition ──
console.log('\n=== Test 5: Chinese Decomposition ===');

const planCN = planner.plan('自动生成一份带数据的行业分析周报');
assert(planCN.tasks.length === 4, `Chinese plan should have 4 tasks, got ${planCN.tasks.length}`);
const rolesCN = planCN.tasks.map((t) => t.agent);
assert(
  rolesCN.includes('data') && rolesCN.includes('research') && rolesCN.includes('analyst') && rolesCN.includes('writer'),
  'Chinese plan should include all four agent roles',
);

// ── Test 6: Mock end-to-end chain (no network) ──
console.log('\n=== Test 6: Mock End-to-End Chain ===');

async function testMockE2E(): Promise<void> {
  process.env.MOCK_LLM = '1';
  const events: string[] = [];
  const ctx = {
    socketId: 'self-test',
    emit: (event: string) => {
      events.push(event);
    },
  };

  const results = await scheduler.execute(planCN.tasks, '自动生成一份带数据的行业分析周报', ctx as any);
  assert(results.length === 4, `E2E should return 4 results, got ${results.length}`);
  assert(results.every((r) => r.output.trim().length > 0), 'Every agent should produce non-empty output');
  assert(results.every((r) => r.tokens > 0), 'Every agent should report token usage');
  assert(results.every((r) => r.cost >= 0), 'Every agent should report cost');
  assert(events.includes('agent:stream'), 'Should emit agent:stream events');
  assert(events.includes('agent:output'), 'Should emit agent:output events');
  assert(events.includes('agent:status'), 'Should emit agent:status events');

  console.log('  Mock E2E: full task:create chain passed (4 agents, streaming + status + output)');
}

// ── Test 7: Analyst Skill structured output + trace/snapshot ──
console.log('\n=== Test 7: Analyst Skill ===');

async function testAnalystSkill(): Promise<void> {
  process.env.MOCK_LLM = '1';
  const events: string[] = [];
  const ctx = {
    socketId: 'self-test',
    emit: (event: string) => {
      events.push(event);
    },
  };

  const analyst = new AnalystAgent();
  const result = await analyst.execute(
    'task-analyst',
    'Analyze Findings',
    '新能源行业战略分析',
    '--- Output from data ---\n{"market_size": 100, "growth": 0.25}',
    ctx as any,
  );
  const parsed = JSON.parse(result.output);

  assert(typeof parsed.summary === 'string' && parsed.summary.length > 0, 'Analyst summary should be non-empty');
  assert(Array.isArray(parsed.keyFindings) && parsed.keyFindings.length > 0, 'Analyst keyFindings should be non-empty');
  assert(Array.isArray(parsed.risks), 'Analyst risks should be an array');
  assert(Array.isArray(parsed.recommendations), 'Analyst recommendations should be an array');
  assert(typeof parsed.confidence === 'number', 'Analyst confidence should be a number');
  assert(events.includes('agent:trace'), 'Should emit agent:trace lifecycle');
  assert(events.includes('agent:snapshot'), 'Should emit agent:snapshot');

  console.log('  Analyst Skill: structured JSON output + trace/snapshot passed');
}

// ── Test 8: All Skill Agents structured output + trace/snapshot ──
console.log('\n=== Test 8: Skill Agents ===');

async function testAllSkills(): Promise<void> {
  process.env.MOCK_LLM = '1';
  const cases = [
    { role: 'data', agent: new DataAgent(), input: '收集 AI 服务器产业链数据' },
    { role: 'research', agent: new ResearchAgent(), input: '调研 AI 服务器产业链动态' },
    { role: 'analyst', agent: new AnalystAgent(), input: '分析 AI 服务器产业链机会' },
    { role: 'writer', agent: new WriterAgent(), input: '生成 AI 服务器产业链行业周报' },
  ];

  for (const item of cases) {
    const events: string[] = [];
    const ctx = {
      socketId: 'self-test',
      emit: (event: string) => {
        events.push(event);
      },
    };
    const result = await item.agent.execute(
      `task-${item.role}`,
      item.role,
      item.input,
      '--- Output from data ---\n{}',
      ctx as any,
    );
    const parsed = JSON.parse(result.output);
    assert(typeof parsed === 'object' && parsed !== null, `${item.role} should return JSON object`);
    assert(
      typeof parsed.confidence === 'number' && parsed.confidence >= 0 && parsed.confidence <= 1,
      `${item.role} confidence should be 0-1`,
    );
    assert(events.includes('agent:trace'), `${item.role} should emit agent:trace`);
    assert(events.includes('agent:snapshot'), `${item.role} should emit agent:snapshot`);
    assert(events.includes('agent:output'), `${item.role} should emit agent:output`);
    console.log(`  ${item.role}: structured output + trace/snapshot passed`);
  }

  console.log('  Skill Agents: all four skills validated');
}

// ── Test 9: Roundtable Moderator Engine ──
console.log('\n=== Test 9: Roundtable Moderator ===');

async function testRoundtable(): Promise<void> {
  process.env.MOCK_LLM = '1';
  const events: string[] = [];
  const ctx = {
    socketId: 'self-test',
    emit: (event: string) => {
      events.push(event);
    },
  };

  const participants = new Map<AgentRole, SkillAgent<any>>();
  participants.set('data', new DataAgent());
  participants.set('research', new ResearchAgent());
  participants.set('analyst', new AnalystAgent());
  participants.set('writer', new WriterAgent());

  const engine = new RoundtableEngine(participants);
  const consensus = await engine.start(
    {
      topic: '新能源企业应该优先布局储能还是光伏？',
      agents: ['data', 'research', 'analyst', 'writer'],
      maxRounds: 2,
    },
    ctx as any,
  );

  assert(consensus.rounds >= 1 && consensus.rounds <= 2, 'Roundtable rounds should be within bounds');
  assert(
    typeof consensus.finalAnswer === 'string' && consensus.finalAnswer.length > 0,
    'finalAnswer should be non-empty',
  );
  assert(
    Array.isArray(consensus.executionTasks) && consensus.executionTasks.length > 0,
    'executionTasks should be non-empty',
  );
  assert(Array.isArray(consensus.risks) && consensus.risks.length > 0, 'risks should be non-empty');
  assert(events.includes('roundtable:speech'), 'roundtable:speech should be emitted');
  assert(events.includes('roundtable:consensus'), 'roundtable:consensus should be emitted');
  assert(events.includes('validator:result'), 'validator:result should be emitted for final solution');

  console.log('  Roundtable: moderator engine passed');
}

// ── Test 10: Validator Output Firewall ──
console.log('\n=== Test 10: Validator Output Firewall ===');

async function testValidator(): Promise<void> {
  process.env.MOCK_LLM = '1';
  const validator = new ValidatorAgent();
  const events: string[] = [];
  const ctx = {
    socketId: 'self-test',
    emit: (event: string) => {
      events.push(event);
    },
  };

  const good = await validator.execute(
    'val-good',
    'Validate writer',
    '校验 writer 的输出',
    '--- Output from [writer] ---\n{"title":"测试报告","summary":"摘要","sections":[],"keyMessages":[],"riskNote":"无","confidence":0.8}',
    ctx as any,
  );
  const goodVerdict = JSON.parse(good.output);
  assert(goodVerdict.pass === true, 'Validator should pass normal output');
  assert(Array.isArray(goodVerdict.failCodes), 'failCodes should be an array');

  const bad = await validator.execute(
    'val-bad',
    'Validate writer',
    '校验 writer 的输出',
    '--- Output from [writer] ---\nFAIL_INJECT 编造数据',
    ctx as any,
  );
  const badVerdict = JSON.parse(bad.output);
  assert(badVerdict.pass === false, 'Validator should reject FAIL_INJECT output');
  assert(
    Array.isArray(badVerdict.failCodes) && badVerdict.failCodes.length > 0,
    'failCodes should be non-empty',
  );

  const failEvents: string[] = [];
  const failCtx = {
    socketId: 'self-test',
    emit: (event: string) => {
      failEvents.push(event);
    },
  };
  const injectPlan = planner.plan('收集数据 FAIL_INJECT');
  let rejected = false;
  try {
    await scheduler.execute(injectPlan.tasks, '收集数据 FAIL_INJECT', failCtx as any);
  } catch (err: any) {
    rejected = true;
    assert(
      String(err.message).includes('Validator 拦截'),
      `Scheduler should stop with Validator interception, got: ${err.message}`,
    );
  }
  assert(rejected, 'Scheduler should reject the injected task');
  assert(failEvents.includes('validator:result'), 'validator:result should be emitted before interception');

  console.log('  Validator: output firewall passed (pass + fail injection + scheduler interception)');
}

// ── Test 11: Experience Memory ──
console.log('\n=== Test 11: Experience Memory ===');

async function testExperienceMemory(): Promise<void> {
  process.env.MOCK_LLM = '1';
  experienceMemory.clear();
  await experienceMemory.record({ taskType: 'analysis', agent: 'analyst', model: 'gpt-4o', success: true });
  await experienceMemory.record({ taskType: 'analysis', agent: 'analyst', model: 'gpt-4o', success: false });

  const stats = experienceMemory.stats();
  assert(stats.total === 2, `memory total should be 2, got ${stats.total}`);
  assert(stats.success === 1 && stats.failure === 1, 'memory should have 1 success and 1 failure');
  assert(
    experienceMemory.pickModel('analyst', 'analysis') === 'gpt-4o',
    'memory should still pick gpt-4o after a 50% rate when it is the only tried model',
  );

  await experienceMemory.record({ taskType: 'analysis', agent: 'analyst', model: 'gpt-4o-mini', success: true });
  await experienceMemory.record({ taskType: 'analysis', agent: 'analyst', model: 'gpt-4o-mini', success: true });
  assert(
    experienceMemory.pickModel('analyst', 'analysis') === 'gpt-4o-mini',
    'memory should switch to gpt-4o-mini after 100% success',
  );
  assert(
    experienceMemory.pickFallback('analyst', 'gpt-4o-mini')[0] === 'gpt-4o',
    'fallback order should prefer the remaining tried model',
  );

  console.log('  Experience Memory: JSON persistence + model selection passed');
}

// ── Test 12: Rollback Engine ──
console.log('\n=== Test 12: Rollback Engine ===');

async function testRollbackEngine(): Promise<void> {
  process.env.MOCK_LLM = '1';
  snapshotStore.clear();

  const events: string[] = [];
  const ctx = {
    socketId: 'self-test',
    emit: (event: string) => {
      events.push(event);
    },
  };
  snapshotStore.save({
    snapshotId: 'snap-restore',
    taskId: 'rb-snap',
    agent: 'analyst',
    timestamp: Date.now(),
    input: { taskId: 'rb-snap', task: '分析' },
    output: { summary: 'restored output' },
    model: 'gpt-4o',
    status: 'success',
  } as any);

  const engine = new RollbackEngine();
  const outcome = await engine.recoverAgent({
    taskId: 'rb-snap',
    taskTitle: 'Analyze',
    role: 'analyst',
    errorType: 'MODEL_ERROR',
    fromModel: 'gpt-4o',
    input: '分析',
    context: '--- Output from [data] ---\n{}',
    agent: new AnalystAgent(),
    ctx: ctx as any,
    failureMessage: 'timeout',
  });
  assert(outcome.recovered, 'snapshot restore should recover the task');
  assert(outcome.strategy === 'snapshot_restore', `strategy should be snapshot_restore, got ${outcome.strategy}`);
  assert(outcome.result?.output.includes('restored output') === true, 'restored output should come from the snapshot');
  assert(events.includes('rollback:start') && events.includes('rollback:complete'), 'rollback events should be emitted');

  snapshotStore.clear();
  const switchEvents: string[] = [];
  const switchCtx = {
    socketId: 'self-test',
    emit: (event: string) => {
      switchEvents.push(event);
    },
  };
  const flakyAgent = {
    role: 'analyst',
    model: 'auto',
    execute: async (
      _taskId: string,
      _title: string,
      _input: string,
      _context: string,
      _execCtx: unknown,
      modelOverride?: string,
    ) => {
      if (modelOverride === 'gpt-4o-mini') {
        return {
          taskId: 'rb-switch',
          role: 'analyst',
          output: '{"summary":"recovered by fallback"}',
          tokens: 10,
          cost: 0.001,
          duration: 10,
          model: 'gpt-4o-mini',
        };
      }
      throw new Error('model failed');
    },
  } as any;

  const outcome2 = await engine.recoverAgent({
    taskId: 'rb-switch',
    taskTitle: 'Analyze',
    role: 'analyst',
    errorType: 'MODEL_ERROR',
    fromModel: 'gpt-4o',
    input: '分析',
    context: '--- Output from [data] ---\n{}',
    agent: flakyAgent,
    ctx: switchCtx as any,
    failureMessage: 'model failed',
  });
  assert(outcome2.recovered, 'model switch should recover the task');
  assert(outcome2.result?.model === 'gpt-4o-mini', 'recovered result should use the fallback model');
  assert(outcome2.toModel === 'gpt-4o-mini', 'outcome should report the fallback model');

  console.log('  Rollback Engine: snapshot restore + model switch passed');
}

// ── Test 13: Dashboard Stats ──
console.log('\n=== Test 13: Dashboard Stats ===');

async function testStats(): Promise<void> {
  statsService.reset();
  statsService.observe('agent:output', {
    taskId: 't1',
    agent: 'analyst',
    tokens: 120,
    cost: 0.001,
    model: 'gpt-4o',
  });
  statsService.observe('agent:output', {
    taskId: 't2',
    agent: 'data',
    tokens: 80,
    cost: 0.0005,
    model: 'gpt-4o-mini',
  });
  statsService.observe('rollback:complete', { taskId: 't3', recovered: true });
  statsService.observe('roundtable:consensus', { topic: '新能源圆桌', rounds: 2, finalAnswer: 'x' });

  const tokens = statsService.getTokens();
  assert(tokens.total === 200, `token total should be 200, got ${tokens.total}`);
  assert(tokens.byAgent.analyst === 120, 'token byAgent should track analyst');
  assert(tokens.byAgent.data === 80, 'token byAgent should track data');

  const cost = statsService.getCost();
  assert(Math.abs(cost.total - 0.0015) < 1e-9, `cost total should be 0.0015, got ${cost.total}`);
  assert(Math.abs(cost.byModel['gpt-4o'] - 0.001) < 1e-9, 'cost byModel should track gpt-4o');

  const roundtable = statsService.getRoundtable();
  assert(roundtable.total === 1 && roundtable.rounds === 2, 'roundtable stats should track count and rounds');

  const health = statsService.getHealth({ activeTasks: 1, activeRoundtables: 0 });
  assert(health.rollbackRecovered === 1 && health.status === 'ok', 'health should track rollback recovery');
  assert(health.activeTasks === 1 && health.activeRoundtables === 0, 'health should include active counts');

  console.log('  Dashboard Stats: tokens/cost/health/roundtable passed');
}

// ── Test 14: New Energy Demo Data ──
console.log('\n=== Test 14: New Energy Demo Data ===');

async function testDemoData(): Promise<void> {
  assert(NEW_ENERGY_PROMPTS.length >= 3, 'Should ship at least 3 demo prompts');
  assert(
    NEW_ENERGY_PROMPTS.some((p) => p.prompt.includes('储能') && p.prompt.includes('光伏')),
    'Prompts should cover the new energy lines',
  );
  assert(NEW_ENERGY_DATASET.storage.gwh === 42.6, 'Storage preset should be 42.6 GWh');
  assert(NEW_ENERGY_DATASET.ev.penetration === 0.547, 'EV penetration preset should be 0.547');

  const ctx = {
    socketId: 'self-test',
    emit: () => {},
  };
  const dataAgent = new DataAgent();
  const result = await dataAgent.execute(
    'demo-data',
    'Gather Data',
    '新能源战略分析：储能、光伏、新能源车',
    '--- Output from [] ---\n{}',
    ctx as any,
  );
  const parsed = JSON.parse(result.output);
  assert(parsed.summary.includes('储能'), 'Data mock should use the new energy dataset');
  assert(Array.isArray(parsed.dataPoints) && parsed.dataPoints.length >= 4, 'Data mock should include 4 data points');

  console.log('  Demo Data: new energy prompts + preset + mock coherence passed');
  console.log('\n=== All self-tests passed ===\n');
}

testMockE2E()
  .then(testAnalystSkill)
  .then(testAllSkills)
  .then(testRoundtable)
  .then(testValidator)
  .then(testExperienceMemory)
  .then(testRollbackEngine)
  .then(testStats)
  .then(testDemoData)
  .catch((err) => {
    console.error('FAIL: self-test error:', err);
    process.exit(1);
  });

// Helper: topological level assignment
function topologicalLevels(tasks: SubTask[]): Map<number, Set<string>> {
  const levels = new Map<number, Set<string>>();
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  const idSet = new Set(tasks.map(t => t.id));

  for (const t of tasks) {
    inDegree.set(t.id, t.dependsOn.length);
    adjacency.set(t.id, []);
  }
  for (const t of tasks) {
    for (const depId of t.dependsOn) {
      adjacency.get(depId)?.push(t.id);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  let level = 0;
  const processed = new Set<string>();

  while (queue.length > 0) {
    const currentLevel = new Set<string>();
    const nextQueue: string[] = [];

    for (const id of queue) {
      currentLevel.add(id);
      processed.add(id);
      for (const neighbor of adjacency.get(id) || []) {
        const newDeg = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0 && !processed.has(neighbor)) {
          nextQueue.push(neighbor);
        }
      }
    }

    levels.set(level, currentLevel);
    level++;
    queue.splice(0, queue.length, ...nextQueue);
  }

  // Check for cycles
  if (processed.size !== tasks.length) {
    return new Map(); // Cycle detected
  }

  return levels;
}
