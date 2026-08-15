import { randomUUID } from 'crypto';
import { MOCK_TEMPLATES, calcCost } from '@hermes/shared';
import type {
  AgentRole,
  SubTask,
  RoundtableConfig,
  RoundtableConsensus,
  RoundtableSpeech,
  RoundtableStance,
} from '@hermes/shared';

/**
 * Mock 回放器（T1.4 双 Mock 一致性）。
 *
 * 在 bridge 侧 1:1 复刻 legacy packages/server 在 MOCK_LLM 模式下的
 * 业务事件流与结构化输出，保证「同样的任务输入 → 同样的演示输出」：
 *   - task:create  → task:plan + agent:status/stream/output + validator:result + 汇总 output
 *   - roundtable:start → roundtable:speech + participant/moderator/validator 的 output + consensus
 *
 * 内容复刻原则：
 *   1. agent:output.content 与 legacy 完全一致（MOCK_TEMPLATES 紧凑 JSON，键序与各
 *      skill validator 重建对象一致，safeTopic/findDataset 用「首行 + 议题」fakeTask 复现）。
 *   2. tokens/cost 按 mockChat 同款启发式（ceil(len/4)）计算，duration 为运行时值。
 *   3. 不持久化 trace/snapshot/experience-memory（bridge 无对应存储，属 observability 元数据）。
 */

export type EmitFn = (event: string, payload: unknown) => void;

// 对应 legacy MODEL_FALLBACKS[role][0]，mock 模式下无 env 覆盖时的默认模型。
const DEFAULT_MODEL = 'gpt-5.5';
// roundtable:speech 中 moderator 的 model 来自 config.model（ModeratorAgent 默认 'auto'）。
const COORDINATOR_SPEECH_MODEL = 'auto';

const DEFAULT_PARTICIPANTS: AgentRole[] = ['data', 'research', 'analyst', 'writer'];
const STREAM_CHUNK_SIZE = 6;
const STREAM_INTERVAL_MS = 8;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Planner 规则拆解（1:1 复刻 packages/server/src/planner.ts planRules）──

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasPattern(text: string, patterns: string[]): boolean {
  return patterns.some((p) => {
    // \b 对 CJK 无效，非 ASCII 用 includes()。
    if (/^[\x00-\x7F]+$/.test(p)) {
      return new RegExp(`\\b${escapeRegex(p)}`, 'i').test(text);
    }
    return text.includes(p);
  });
}

interface PlanResult {
  tasks: SubTask[];
  reasoning: string;
  source: 'rules';
}

function makeTask(id: string, title: string, agent: AgentRole, dependsOn: string[]): SubTask {
  return { id, title, agent, dependsOn, status: 'pending' };
}

function planRules(message: string): PlanResult {
  const lower = message.toLowerCase();

  const needsData = hasPattern(lower, [
    'data', 'collect', 'gather', 'fetch', 'scrape', 'extract',
    'find', 'search', 'look up', 'query',
    '数据', '收集', '采集', '获取', '抓取', '查询', '查找', '资料',
  ]);
  const needsResearch = hasPattern(lower, [
    'research', 'investigate', 'explore', 'survey', 'review',
    'compare', 'latest', 'trend', 'news',
    '研究', '调研', '调查', '探索', '新闻', '最新', '动态', '趋势', '行业', '盘点',
  ]);
  const needsAnalysis = hasPattern(lower, [
    'analyze', 'analysis', 'insight', 'evaluate', 'assess',
    'metric', 'kpi', 'trend', 'pattern', 'predict',
    '分析', '洞察', '评估', '判断', '预测', '解读', '观点', '周报',
  ]);
  const needsWriting = hasPattern(lower, [
    'write', 'generate', 'report', 'article', 'summary',
    'document', 'blog', 'email', 'draft', 'create',
    '写', '生成', '报告', '周报', '文章', '文档', '总结', '整理', '起草', '输出', '发布',
  ]);

  // 默认流水线：research → analyze → write
  if (!needsData && !needsResearch && !needsAnalysis && !needsWriting) {
    const ids = { r: randomUUID(), a: randomUUID(), w: randomUUID() };
    return {
      tasks: [
        makeTask(ids.r, 'Research Topic', 'research', []),
        makeTask(ids.a, 'Analyze Findings', 'analyst', [ids.r]),
        makeTask(ids.w, 'Generate Report', 'writer', [ids.r, ids.a]),
      ],
      reasoning: 'Default pipeline: research → analyze → write',
      source: 'rules',
    };
  }

  const ids = {
    data: randomUUID(),
    research: randomUUID(),
    analyst: randomUUID(),
    writer: randomUUID(),
  };
  const tasks: SubTask[] = [];

  if (needsData) tasks.push(makeTask(ids.data, 'Gather Data', 'data', []));
  if (needsResearch) {
    tasks.push(makeTask(ids.research, 'Research Topic', 'research', needsData ? [ids.data] : []));
  }
  if (needsAnalysis) {
    const deps: string[] = [];
    if (needsData) deps.push(ids.data);
    if (needsResearch) deps.push(ids.research);
    tasks.push(makeTask(ids.analyst, 'Analyze Findings', 'analyst', deps));
  }
  if (needsWriting) {
    const deps: string[] = [];
    if (needsData) deps.push(ids.data);
    if (needsResearch) deps.push(ids.research);
    if (needsAnalysis) deps.push(ids.analyst);
    tasks.push(makeTask(ids.writer, 'Generate Report', 'writer', deps));
  }

  return {
    tasks,
    reasoning: `Detected: data=${needsData} research=${needsResearch} analysis=${needsAnalysis} writing=${needsWriting}`,
    source: 'rules',
  };
}

// ── Mock 执行原语 ──

/**
 * fakeTask 复现 legacy prompt 的「首行 + 议题文本」，
 * 使 MOCK_TEMPLATES 内部的 safeTopic（取首行）与 findDataset（关键词匹配）
 * 返回与 legacy 相同的结果。
 */
function taskText(role: AgentRole, topic: string): string {
  return role === 'moderator' ? `## 会议议题\n${topic}\n` : `## 任务\n${topic}\n`;
}

interface MockResult {
  taskId: string;
  role: AgentRole;
  content: string;
  tokens: number;
  cost: number;
  duration: number;
  model: string;
}

async function runSkillMock(
  role: AgentRole,
  taskId: string,
  topic: string,
  emit: EmitFn,
  opts?: { stream?: boolean },
): Promise<MockResult> {
  const stream = opts?.stream ?? true;
  const text = taskText(role, topic);
  const raw = MOCK_TEMPLATES[role](text);
  // 紧凑 JSON，键序与各 skill validator 重建对象一致。
  const content = JSON.stringify(JSON.parse(raw));
  const model = DEFAULT_MODEL;
  const startTime = Date.now();

  emit('agent:status', { taskId, agent: role, status: 'running', progress: 0, model });

  for (let i = 0; i < raw.length; i += STREAM_CHUNK_SIZE) {
    if (stream) {
      emit('agent:stream', { taskId, agent: role, chunk: raw.slice(i, i + STREAM_CHUNK_SIZE) });
    }
    await sleep(STREAM_INTERVAL_MS);
  }

  const inputTokens = Math.ceil(text.length / 4);
  const outputTokens = Math.ceil(raw.length / 4);
  const tokens = inputTokens + outputTokens;
  const cost = calcCost(model, inputTokens, outputTokens);
  const duration = Date.now() - startTime;

  emit('agent:output', { taskId, agent: role, content, tokens, cost, duration, model });
  emit('agent:status', { taskId, agent: role, status: 'success', progress: 100, model });

  return { taskId, role, content, tokens, cost, duration, model };
}

interface ValidatorVerdict {
  pass: boolean;
  scores: { accuracy: number; completeness: number; safety: number; format: number };
  failCodes: string[];
  issues: string[];
}

async function runValidatorMock(
  targetAgent: AgentRole,
  targetTaskId: string,
  validatorTaskId: string,
  targetOutput: string,
  topic: string,
  emit: EmitFn,
  opts?: { stream?: boolean },
): Promise<void> {
  const stream = opts?.stream ?? true;
  // 复刻 legacy validateResult 的候选输入：`--- Output from [role] ---\n${output}\n\n--- Task ---\n${message}`。
  const candidate = `--- Output from [${targetAgent}] ---\n${targetOutput}\n\n--- Task ---\n${topic}`;
  const raw = MOCK_TEMPLATES.validator(candidate);
  const content = JSON.stringify(JSON.parse(raw));
  const verdict = JSON.parse(content) as ValidatorVerdict;
  const model = DEFAULT_MODEL;
  const startTime = Date.now();

  emit('agent:status', { taskId: validatorTaskId, agent: 'validator', status: 'running', progress: 0, model });

  for (let i = 0; i < raw.length; i += STREAM_CHUNK_SIZE) {
    if (stream) {
      emit('agent:stream', { taskId: validatorTaskId, agent: 'validator', chunk: raw.slice(i, i + STREAM_CHUNK_SIZE) });
    }
    await sleep(STREAM_INTERVAL_MS);
  }

  const inputTokens = Math.ceil(candidate.length / 4);
  const outputTokens = Math.ceil(raw.length / 4);
  const tokens = inputTokens + outputTokens;
  const cost = calcCost(model, inputTokens, outputTokens);
  const duration = Date.now() - startTime;

  emit('agent:output', { taskId: validatorTaskId, agent: 'validator', content, tokens, cost, duration, model });
  emit('agent:status', { taskId: validatorTaskId, agent: 'validator', status: 'success', progress: 100, model });

  emit('validator:result', {
    taskId: targetTaskId,
    agent: targetAgent,
    pass: verdict.pass,
    scores: verdict.scores,
    failCodes: verdict.failCodes,
    issues: verdict.issues,
    ...(verdict.issues.length > 0 ? { reason: verdict.issues.join('; ') } : {}),
  });
}

// ── task:create 回放 ──

export async function playTask(message: string, emit: EmitFn): Promise<void> {
  const plan = planRules(message);
  emit('task:plan', { tasks: plan.tasks, reasoning: plan.reasoning, source: plan.source });

  const results: MockResult[] = [];
  const completed = new Map<string, string>();
  const remaining = new Map(plan.tasks.map((t) => [t.id, t]));

  let round = 0;
  const maxRounds = plan.tasks.length * 2;

  while (remaining.size > 0 && round < maxRounds) {
    round++;

    const ready: SubTask[] = [];
    for (const task of remaining.values()) {
      if (task.dependsOn.every((depId) => completed.has(depId))) ready.push(task);
    }

    if (ready.length === 0) {
      emit('task:error', {
        message: `Scheduler: deadlock detected at round ${round}. Remaining: ${remaining.size} tasks.`,
      });
      break;
    }

    // 与 legacy 一致：同层就绪任务并行执行（stream 交错），结果按就绪顺序稳定收集。
    const batchResults = await Promise.all(
      ready.map(async (task) => {
        const result = await runSkillMock(task.agent, task.id, message, emit, { stream: true });
        await runValidatorMock(
          task.agent,
          task.id,
          `val_${task.id}`,
          result.content,
          message,
          emit,
          { stream: true },
        );
        return { task, result };
      }),
    );

    for (const { task, result } of batchResults) {
      completed.set(result.taskId, result.content);
      results.push(result);
    }

    for (const task of ready) remaining.delete(task.id);
  }

  const summary = results
    .map((r) => `[${r.role}] ${r.content.slice(0, 300)}${r.content.length > 300 ? '...' : ''}`)
    .join('\n\n---\n\n');

  emit('agent:output', {
    taskId: `task_${Date.now()}`,
    agent: 'writer',
    content: `## Task Complete\n\n${summary}`,
    tokens: results.reduce((s, r) => s + r.tokens, 0),
    cost: results.reduce((s, r) => s + r.cost, 0),
    duration: results.reduce((s, r) => s + r.duration, 0),
  });
}

// ── roundtable:start 回放 ──

export async function playRoundtable(
  config: RoundtableConfig,
  emit: EmitFn,
): Promise<RoundtableConsensus> {
  const taskId = `rt_${Date.now()}`;
  const roles = config.agents && config.agents.length > 0 ? config.agents : DEFAULT_PARTICIPANTS;
  const maxRounds = Math.min(Math.max(config.maxRounds ?? 3, 1), 3);
  const speeches: RoundtableSpeech[] = [];

  // Phase 1：moderator 目标确认（model 取 config.model，即 'auto'）。
  emit('roundtable:speech', {
    round: 0,
    agent: 'moderator',
    model: COORDINATOR_SPEECH_MODEL,
    content: `目标确认：议题「${config.topic}」；成功标准是形成可执行、经过验证的方案；限制条件：最多 ${maxRounds} 轮讨论。`,
    stance: 'moderate',
  } satisfies RoundtableSpeech);

  // Phase 2：观点收集（roundCtx 过滤 agent:stream，故 stream: false）。
  for (let round = 1; round <= maxRounds; round++) {
    for (const [index, role] of roles.entries()) {
      const stance: RoundtableStance =
        round === 1 ? 'propose' : round === 2 ? (index % 2 === 0 ? 'challenge' : 'supplement') : 'supplement';

      const participantTaskId = `${taskId}_r${round}_${role}`;
      const result = await runSkillMock(role, participantTaskId, config.topic, emit, { stream: false });

      const speech: RoundtableSpeech = {
        round,
        agent: role,
        model: result.model,
        content: result.content.length > 2000 ? `${result.content.slice(0, 2000)}...` : result.content,
        stance,
      };
      speeches.push(speech);
      emit('roundtable:speech', speech);
    }
  }

  // Phase 3 + 4：moderator 收敛 + validator 质检。
  const moderatorResult = await runSkillMock(
    'moderator',
    `${taskId}_synthesis`,
    config.topic,
    emit,
    { stream: false },
  );
  const output = JSON.parse(moderatorResult.content) as {
    finalSolution: string;
    agentContributions: Array<{ agent: string; contribution: string }>;
    executionTasks: unknown[];
    risks: string[];
  };

  await runValidatorMock(
    'moderator',
    taskId,
    `${taskId}_validation`,
    moderatorResult.content,
    config.topic,
    emit,
    { stream: false },
  );

  const consensus: RoundtableConsensus = {
    rounds: Math.max(...speeches.filter((s) => s.round > 0).map((s) => s.round), 0),
    finalAnswer: output.finalSolution,
    agreements: output.agentContributions.map((c) => `${c.agent}: ${c.contribution}`),
    disagreements: output.risks,
    finalSolution: output.finalSolution,
    executionTasks: output.executionTasks as RoundtableConsensus['executionTasks'],
    risks: output.risks,
  };

  const finalContent =
    typeof output.finalSolution === 'string'
      ? output.finalSolution
      : JSON.stringify(output.finalSolution);
  emit('roundtable:speech', {
    round: maxRounds + 1,
    agent: 'moderator',
    model: COORDINATOR_SPEECH_MODEL,
    content: finalContent,
    stance: 'synthesize',
  } satisfies RoundtableSpeech);

  emit('roundtable:consensus', consensus);
  return consensus;
}
