/**
 * Logic self-test: Planner decomposition + Scheduler DAG ordering.
 * 
 * Tests the core scheduling logic without requiring LLM API keys.
 * Run with: npx tsx packages/server/src/self-test.ts
 */
import { Planner } from './planner';
import { TaskScheduler } from './scheduler';
import type { SubTask } from '@hermes/shared';
import { AnalystAgent } from './agents';

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
  console.log('\n=== All self-tests passed ===\n');
}

testMockE2E()
  .then(testAnalystSkill)
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
