import type {
  AgentRole,
  RoundtableConfig,
  RoundtableConsensus,
  RoundtableSpeech,
  RoundtableStance,
  RoundtableTask,
} from '@hermes/shared';
import { buildTaskBody, parseWorkerResult } from './task-protocol';
import type { SharedEmit } from './event-mapping';

/**
 * T4 圆桌辩论（hiclaw 适配）。
 *
 * 对齐 legacy packages/server/src/roundtable-engine.ts 的流程，但执行单元由
 * 本地 SkillAgent 改为远程 Worker 派发（Matrix 群房 @mention 唤醒）：
 *   Phase 1  moderator 目标确认（round=0，本地 emit）
 *   Phase 2  多轮意见收集（每轮每 participant 远程派发，注入历史 transcript）
 *   Phase 3  moderator 收敛合成（远程派发，返回结构化 ModeratorSynthesis）
 *   Phase 4  发布 roundtable:consensus
 *
 * Validator / Rollback 校验（legacy validateConsensus）属 T5 治理能力，本阶段不接入。
 */

const DEFAULT_PARTICIPANTS: AgentRole[] = ['data', 'research', 'analyst', 'writer'];

/** 远程派发接口（与 Orchestrator.dispatchTask 兼容） */
export type RoundtableDispatch = (
  task: string,
  opts?: { taskId?: string; role?: AgentRole; timeoutMs?: number },
) => Promise<string>;

export interface RoundtableRunnerOptions {
  dispatch: RoundtableDispatch;
  emit?: SharedEmit;
  log?: (message: string) => void;
}

/** moderator 收敛输出契约（与 legacy ModeratorOutput 对齐，字段取运行必需子集） */
export interface ModeratorSynthesis {
  meetingSummary?: string;
  finalSolution: string;
  agentContributions?: Array<{ agent: string; contribution: string }>;
  executionTasks?: RoundtableTask[];
  risks?: string[];
  confidence?: number;
}

const STANCE_HINTS: Record<RoundtableStance, string> = {
  propose: '请提出你的核心观点与方案。',
  agree: '请表达同意并补充理由。',
  challenge: '请从风险与反面角度质疑现有观点。',
  supplement: '请补充被忽略的细节与改进建议。',
  moderate: '请中立协调各方观点。',
  synthesize: '请综合收敛各方意见形成最终方案。',
};

export class RoundtableRunner {
  private readonly dispatch: RoundtableDispatch;
  private readonly emit: SharedEmit;
  private readonly log: (message: string) => void;

  constructor(opts: RoundtableRunnerOptions) {
    this.dispatch = opts.dispatch;
    this.emit = opts.emit ?? (() => {});
    this.log = opts.log ?? (() => {});
  }

  async start(config: RoundtableConfig): Promise<RoundtableConsensus> {
    const taskId = `rt_${Date.now()}`;
    const roles = config.agents && config.agents.length > 0 ? config.agents : DEFAULT_PARTICIPANTS;
    const maxRounds = Math.min(Math.max(config.maxRounds ?? 3, 1), 3);
    const speeches: RoundtableSpeech[] = [];

    // Phase 1: moderator 目标确认（round=0，本地 emit，不消耗 Worker）
    this.emit('roundtable:speech', {
      round: 0,
      agent: 'moderator',
      model: '',
      content: `目标确认：议题「${config.topic}」；成功标准是形成可执行、经过验证的方案；限制条件：最多 ${maxRounds} 轮讨论。`,
      stance: 'moderate',
    } satisfies RoundtableSpeech);

    // Phase 2: 多轮意见收集（每轮每 participant 远程派发，注入历史 transcript）
    for (let round = 1; round <= maxRounds; round++) {
      for (const [index, role] of roles.entries()) {
        const stance: RoundtableStance =
          round === 1 ? 'propose' : round === 2 ? (index % 2 === 0 ? 'challenge' : 'supplement') : 'supplement';
        const transcript = this.buildTranscript(speeches);
        const speechTaskId = `${taskId}_r${round}_${role}`;
        const body = buildTaskBody({
          taskId: speechTaskId,
          role,
          title: `Round ${round} - ${role}`,
          userMessage: [
            `议题：${config.topic}`,
            `本轮立场：${stance}`,
            STANCE_HINTS[stance],
            transcript ? `\n<已有讨论>\n${transcript}\n</已有讨论>` : '',
          ].join('\n'),
          upstreamOutputs: [],
        });

        const raw = await this.dispatch(body, { taskId: speechTaskId, role });
        const parsed = parseWorkerResult(raw);
        const content = parsed.content.length > 2000 ? `${parsed.content.slice(0, 2000)}...` : parsed.content;
        const speech: RoundtableSpeech = {
          round,
          agent: role,
          model: parsed.usage.model ?? '',
          content,
          stance,
        };
        speeches.push(speech);
        this.emit('roundtable:speech', { ...speech });
      }
    }

    // Phase 3: moderator 收敛合成（远程派发，返回结构化 ModeratorSynthesis）
    const transcriptContext = this.buildTranscript(speeches);
    const synthTaskId = `${taskId}_synthesis`;
    const synthBody = buildTaskBody({
      taskId: synthTaskId,
      role: 'moderator',
      title: 'Roundtable Synthesis',
      userMessage: [
        `议题：${config.topic}`,
        '请基于以下讨论记录，收敛各方意见并输出最终方案。',
        `<讨论记录>\n${transcriptContext}\n</讨论记录>`,
        '<输出要求> 请把最终方案作为 content 字段的值，content 必须是一个 JSON 对象字符串，结构如下：',
        '{"finalSolution":"最终方案正文","agentContributions":[{"agent":"角色","contribution":"贡献"}],"executionTasks":[{"agent":"角色","input":"输入","expectedOutput":"期望输出"}],"risks":["风险"],"confidence":0.9}',
        '</输出要求>',
      ].join('\n'),
      upstreamOutputs: [],
    });

    const synthRaw = await this.dispatch(synthBody, { taskId: synthTaskId, role: 'moderator' });
    const synthParsed = parseWorkerResult(synthRaw);
    const synthesis = this.parseSynthesis(synthParsed.content);

    // Phase 4: 发布 consensus
    const consensus: RoundtableConsensus = {
      rounds: Math.max(...speeches.filter((s) => s.round > 0).map((s) => s.round), 0),
      finalAnswer: synthesis.finalSolution,
      agreements: synthesis.agentContributions?.map((c) => `${c.agent}: ${c.contribution}`) ?? [],
      disagreements: synthesis.risks ?? [],
      finalSolution: synthesis.finalSolution,
      executionTasks: synthesis.executionTasks ?? [],
      risks: synthesis.risks ?? [],
    };

    this.emit('roundtable:speech', {
      round: maxRounds + 1,
      agent: 'moderator',
      model: synthParsed.usage.model ?? '',
      content: typeof synthesis.finalSolution === 'string'
        ? synthesis.finalSolution
        : JSON.stringify(synthesis.finalSolution),
      stance: 'synthesize',
    } satisfies RoundtableSpeech);
    this.emit('roundtable:consensus', { ...consensus });
    return consensus;
  }

  private buildTranscript(speeches: RoundtableSpeech[]): string {
    if (speeches.length === 0) return '';
    return speeches
      .map((s) => `[Round ${s.round} ${s.agent} ${s.stance}]\n${s.content}`)
      .join('\n\n');
  }

  /** 解析 moderator 收敛结果：优先结构化 JSON，失败回退为原文 */
  private parseSynthesis(raw: string): ModeratorSynthesis {
    try {
      const json = this.extractJson(raw);
      if (json && typeof json.finalSolution === 'string') {
        return json as unknown as ModeratorSynthesis;
      }
    } catch {
      // fallthrough
    }
    return { finalSolution: raw };
  }

  private extractJson(raw: string): Record<string, unknown> | null {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    const candidate = fenced ?? raw;
    try {
      const v = JSON.parse(candidate.trim());
      return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
    } catch {
      const start = candidate.indexOf('{');
      if (start < 0) return null;
      const end = candidate.lastIndexOf('}');
      if (end <= start) return null;
      try {
        const v = JSON.parse(candidate.slice(start, end + 1));
        return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
      } catch {
        return null;
      }
    }
  }
}
