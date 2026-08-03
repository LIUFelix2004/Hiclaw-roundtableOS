import type { SubTask, AgentRole } from '@hermes/shared';
import type { PlanResult } from './types';
import { v4 as uuid } from 'uuid';

/**
 * Planner: decomposes a user message into a DAG of SubTasks,
 * assigning each subtask to the appropriate agent role.
 *
 * Phase 1 stub uses rule-based decomposition.
 * Phase 2 will use an LLM-based planner.
 */
export class Planner {
  /**
   * Decompose a user message into subtasks with dependencies.
   */
  plan(message: string, _context?: string): PlanResult {
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
