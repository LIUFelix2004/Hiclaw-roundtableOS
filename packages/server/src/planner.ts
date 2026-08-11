import type { AgentRole, SubTask } from '@hermes/shared';
import type { PlanResult } from './types';
import { v4 as uuid } from 'uuid';
import { chat, isMockEnabled } from './llm';

const EXECUTABLE_ROLES: readonly AgentRole[] = ['data', 'research', 'analyst', 'writer'];
const MAX_TASKS = 6;

const PLANNER_SYSTEM_PROMPT = `你是 Hermes AgentOS 的 LLM 任务规划器。
把用户请求拆成 1-6 个可并行或串行执行的子任务 DAG。
可用 agent 只能是 data / research / analyst / writer。
tasks 必须按拓扑顺序排列；dependsOn 是 0-based 索引数组，只能引用排在当前任务之前的任务索引。
只输出 JSON，不要 Markdown 代码块：
{"reasoning":"一句话说明拆解思路","tasks":[{"title":"子任务标题","agent":"data","dependsOn":[]}]}`;

/**
 * Planner: decomposes a user message into a DAG of SubTasks.
 *
 * Primary path is LLM-driven JSON decomposition; the deterministic
 * rule-based pipeline remains as an offline/fallback path.
 */
export class Planner {
  /**
   * Decompose a user message into subtasks with dependencies.
   */
  async plan(message: string, context = ''): Promise<PlanResult> {
    if (!isMockEnabled() && process.env.PLANNER_LLM !== '0') {
      try {
        const result = await chat({
          role: 'planner',
          systemPrompt: PLANNER_SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `任务：${message}\n上下文：${context || '无'}`,
            },
          ],
          temperature: 0.2,
          maxTokens: 1200,
          timeoutMs: 20000,
        });
        const llmPlan = parsePlannerPlan(result.content);
        if (llmPlan) {
          console.log(
            `[planner] LLM 拆解 ${llmPlan.tasks.length} 个子任务: ${llmPlan.reasoning}`,
          );
          return llmPlan;
        }
        console.warn('[planner] LLM 输出无法解析，回退规则拆解');
      } catch (err: any) {
        console.warn(`[planner] LLM 拆解失败，回退规则拆解: ${err?.message ?? err}`);
      }
    }
    return this.planRules(message);
  }

  private planRules(message: string): PlanResult {
    const lower = message.toLowerCase();
    const tasks: SubTask[] = [];

    // Heuristic: detect task type from message content
    const needsData = this.hasPattern(lower, [
      'data', 'collect', 'gather', 'fetch', 'scrape', 'extract',
      'find', 'search', 'look up', 'query',
      '数据', '收集', '采集', '获取', '抓取', '查询', '查找', '资料',
    ]);
    const needsResearch = this.hasPattern(lower, [
      'research', 'investigate', 'explore', 'survey', 'review',
      'compare', 'latest', 'trend', 'news',
      '研究', '调研', '调查', '探索', '新闻', '最新', '动态', '趋势', '行业', '盘点',
    ]);
    const needsAnalysis = this.hasPattern(lower, [
      'analyze', 'analysis', 'insight', 'evaluate', 'assess',
      'metric', 'kpi', 'trend', 'pattern', 'predict',
      '分析', '洞察', '评估', '判断', '预测', '解读', '观点', '周报',
    ]);
    const needsWriting = this.hasPattern(lower, [
      'write', 'generate', 'report', 'article', 'summary',
      'document', 'blog', 'email', 'draft', 'create',
      '写', '生成', '报告', '周报', '文章', '文档', '总结', '整理', '起草', '输出', '发布',
    ]);

    // Default pipeline: research → analyze → write
    if (!needsData && !needsResearch && !needsAnalysis && !needsWriting) {
      return this.buildDefaultPipeline(message);
    }

    const ids = {
      data: uuid(),
      research: uuid(),
      analyst: uuid(),
      writer: uuid(),
    };

    // Build pipeline based on detected needs
    if (needsData) {
      tasks.push(this.makeTask(ids.data, 'Gather Data', 'data', []));
    }
    if (needsResearch) {
      const deps: string[] = needsData ? [ids.data] : [];
      tasks.push(this.makeTask(ids.research, 'Research Topic', 'research', deps));
    }
    if (needsAnalysis) {
      const deps: string[] = [];
      if (needsData) deps.push(ids.data);
      if (needsResearch) deps.push(ids.research);
      tasks.push(this.makeTask(ids.analyst, 'Analyze Findings', 'analyst', deps));
    }
    if (needsWriting) {
      const deps: string[] = [];
      if (needsData) deps.push(ids.data);
      if (needsResearch) deps.push(ids.research);
      if (needsAnalysis) deps.push(ids.analyst);
      tasks.push(this.makeTask(ids.writer, 'Generate Report', 'writer', deps));
    }

    return {
      tasks,
      reasoning: `Detected: data=${needsData} research=${needsResearch} analysis=${needsAnalysis} writing=${needsWriting}`,
      source: 'rules',
    };
  }

  private buildDefaultPipeline(message: string): PlanResult {
    const ids = { r: uuid(), a: uuid(), w: uuid() };
    return {
      tasks: [
        this.makeTask(ids.r, 'Research Topic', 'research', []),
        this.makeTask(ids.a, 'Analyze Findings', 'analyst', [ids.r]),
        this.makeTask(ids.w, 'Generate Report', 'writer', [ids.r, ids.a]),
      ],
      reasoning: 'Default pipeline: research → analyze → write',
      source: 'rules',
    };
  }

  private makeTask(id: string, title: string, agent: AgentRole, dependsOn: string[]): SubTask {
    return { id, title, agent, dependsOn, status: 'pending' };
  }

  private hasPattern(text: string, patterns: string[]): boolean {
    return patterns.some((p) => {
      // \b does not work between CJK characters; use includes() for non-ASCII patterns.
      if (/^[\x00-\x7F]+$/.test(p)) {
        // Word-start boundary matches plurals/derivatives e.g. 'trend' matches 'trends'.
        return new RegExp(`\\b${this.escapeRegex(p)}`, 'i').test(text);
      }
      return text.includes(p);
    });
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

/**
 * Parse and validate the LLM planner JSON.
 *
 * Tasks must be listed in topological order; dependencies are 0-based
 * indexes that may only reference earlier tasks. Invalid output returns
 * null so the caller can fall back to the deterministic rule planner.
 */
export function parsePlannerPlan(raw: string): PlanResult | null {
  const cleaned = raw.replace(/```json|```/gi, '').trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  const specs = Array.isArray(parsed?.tasks) ? parsed.tasks : null;
  if (!specs || specs.length === 0 || specs.length > MAX_TASKS) return null;

  const tasks: SubTask[] = [];
  const idByIndex = new Map<number, string>();
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const title = typeof spec?.title === 'string' ? spec.title.trim() : '';
    const agent = spec?.agent;
    if (!title || !EXECUTABLE_ROLES.includes(agent)) return null;
    const id = uuid();
    idByIndex.set(i, id);
    tasks.push({ id, title, agent, dependsOn: [], status: 'pending' });
  }

  for (let i = 0; i < specs.length; i++) {
    const deps = Array.isArray(specs[i]?.dependsOn) ? specs[i].dependsOn : [];
    const resolved = new Set<string>();
    for (const dep of deps) {
      if (!Number.isInteger(dep) || dep < 0 || dep >= i) return null;
      resolved.add(idByIndex.get(dep)!);
    }
    tasks[i].dependsOn = [...resolved];
  }

  return {
    tasks,
    reasoning:
      typeof parsed.reasoning === 'string' && parsed.reasoning.trim()
        ? parsed.reasoning.trim()
        : 'LLM planner 自动拆解任务 DAG',
    source: 'llm',
  };
}
