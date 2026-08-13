import type {
  AgentRole,
  RoundtableConfig,
  RoundtableConsensus,
  RoundtableSpeech,
  RoundtableTask,
} from '@hermes/shared';
import type { ExecutionContext } from './types';
import type { AgentResult } from './types';
import type { SkillAgent } from './agents/skill-agent';
import { classifyError } from './agents/skill-agent';
import { ModeratorAgent } from './agents/moderator';
import type { ModeratorOutput } from './agents/moderator/schema';
import { ValidatorAgent } from './agents/validator';
import type { ValidatorOutput } from './agents/validator/schema';
import { RollbackEngine } from './rollback-engine';

const DEFAULT_PARTICIPANTS: AgentRole[] = ['data', 'research', 'analyst', 'writer'];

/**
 * Roundtable engine.
 *
 * The Moderator Agent is the coordinator: it confirms the goal, enforces the
 * discussion loop (max 3 rounds), collects structured opinions from the
 * participants, and synthesizes the final solution with an execution plan.
 */
export class RoundtableEngine {
  private moderator = new ModeratorAgent();
  private validator = new ValidatorAgent();
  private rollbackEngine = new RollbackEngine();

  constructor(private participants: Map<AgentRole, SkillAgent<any>>) {}

  async start(config: RoundtableConfig, ctx: ExecutionContext): Promise<RoundtableConsensus> {
    const taskId = `rt_${Date.now()}`;
    const roles = config.agents && config.agents.length > 0 ? config.agents : DEFAULT_PARTICIPANTS;
    const maxRounds = Math.min(Math.max(config.maxRounds ?? 3, 1), 3);
    const roundCtx = this.wrapCtx(ctx);
    const speeches: RoundtableSpeech[] = [];

    // Phase 1: goal confirmation by the moderator.
    ctx.emit('roundtable:speech', {
      round: 0,
      agent: 'moderator',
      model: this.moderator.model,
      content: `目标确认：议题「${config.topic}」；成功标准是形成可执行、经过验证的方案；限制条件：最多 ${maxRounds} 轮讨论。`,
      stance: 'moderate',
    } satisfies RoundtableSpeech);

    // Phase 2: opinion collection with round control.
    for (let round = 1; round <= maxRounds; round++) {
      for (const [index, role] of roles.entries()) {
        const agent = this.participants.get(role);
        if (!agent) continue;

        const stance: RoundtableSpeech['stance'] =
          round === 1 ? 'propose' : round === 2 ? (index % 2 === 0 ? 'challenge' : 'supplement') : 'supplement';
        const transcript = this.buildTranscript(speeches);
        const taskIdWithRole = `${taskId}_r${round}_${role}`;
        let result: AgentResult;
        try {
          result = await agent.execute(
            taskIdWithRole,
            `Round ${round} - ${role}`,
            config.topic,
            transcript,
            roundCtx,
          );
        } catch (err: any) {
          const outcome = await this.rollbackEngine.recoverAgent({
            taskId: taskIdWithRole,
            taskTitle: `Round ${round} - ${role}`,
            role,
            errorType: (err as any).errorType ?? classifyError(err),
            fromModel: (err as any).model ?? agent.model,
            input: config.topic,
            context: transcript,
            agent,
            ctx: roundCtx,
            failureMessage: err?.message ?? String(err),
          });
          if (!outcome.recovered || !outcome.result) throw err;
          result = outcome.result;
        }

        const speech: RoundtableSpeech = {
          round,
          agent: role,
          model: result.model ?? agent.model,
          content: result.output.length > 2000 ? `${result.output.slice(0, 2000)}...` : result.output,
          stance,
        };
        speeches.push(speech);
        ctx.emit('roundtable:speech', speech);
      }
    }

    // Phase 3 + 4: convergence synthesis by the moderator.
    const transcriptContext = `--- Output from [roundtable] Transcript ---\n${speeches
      .map((s) => `[Round ${s.round} ${s.agent} ${s.stance}]\n${s.content}`)
      .join('\n\n')}`;
    const moderatorResult = await this.moderator.execute(
      `${taskId}_synthesis`,
      'Roundtable Synthesis',
      config.topic,
      transcriptContext,
      roundCtx,
    );
    const output = JSON.parse(moderatorResult.output) as ModeratorOutput;

    // Output firewall: the final solution must pass Validator before consensus
    // is published. failCodes are aligned with ErrorType for Rollback.
    try {
      await this.validateConsensus(
        taskId,
        config.topic,
        transcriptContext,
        moderatorResult,
        roundCtx,
      );
    } catch (validationErr: any) {
      console.warn(`[roundtable] validation failed, proceeding with unvalidated consensus: ${validationErr?.message}`);
    }

    const consensus: RoundtableConsensus = {
      rounds: Math.max(...speeches.filter((s) => s.round > 0).map((s) => s.round), 0),
      finalAnswer: output.finalSolution,
      agreements: output.agentContributions.map((c) => `${c.agent}: ${c.contribution}`),
      disagreements: output.risks,
      finalSolution: output.finalSolution,
      executionTasks: output.executionTasks as RoundtableTask[],
      risks: output.risks,
    };

    const finalContent = typeof output.finalSolution === 'string'
      ? output.finalSolution
      : JSON.stringify(output.finalSolution);
    ctx.emit('roundtable:speech', {
      round: maxRounds + 1,
      agent: 'moderator',
      model: this.moderator.model,
      content: finalContent,
      stance: 'synthesize',
    } satisfies RoundtableSpeech);
    ctx.emit('roundtable:consensus', consensus);
    return consensus;
  }

  private buildTranscript(speeches: RoundtableSpeech[]): string {
    if (speeches.length === 0) return '';
    return `--- Output from [roundtable] Transcript ---\n${speeches
      .map((s) => `[Round ${s.round} ${s.agent} ${s.stance}]\n${s.content}`)
      .join('\n\n')}`;
  }

  private async validateConsensus(
    taskId: string,
    topic: string,
    transcriptContext: string,
    moderatorResult: AgentResult,
    roundCtx: ExecutionContext,
  ): Promise<void> {
    const maxRecoveries = 5;
    let current = moderatorResult;
    for (let attempt = 0; attempt < maxRecoveries; attempt++) {
      const validationCandidate = `--- Output from [moderator] ---\n${current.output}\n\n--- Task ---\n${topic}`;
      const validatorResult = await this.validator.execute(
        `${taskId}_validation`,
        'Validate Consensus',
        '校验圆桌最终方案',
        validationCandidate,
        roundCtx,
      );
      const verdict = JSON.parse(validatorResult.output) as ValidatorOutput;
      roundCtx.emit('validator:result', {
        taskId,
        agent: 'moderator',
        pass: verdict.pass,
        scores: verdict.scores,
        failCodes: verdict.failCodes,
        issues: verdict.issues,
        reason: verdict.issues.length > 0 ? verdict.issues.join('; ') : undefined,
      });
      if (verdict.pass) return;

      if (attempt === maxRecoveries - 1) {
        throw new Error(
          `Validator 拦截圆桌最终方案: ${verdict.failCodes.join(', ') || 'UNKNOWN'} - ${verdict.issues.join('; ')}`,
        );
      }
      const outcome = await this.rollbackEngine.recoverValidation({
        taskId: `${taskId}_synthesis`,
        taskTitle: 'Roundtable Synthesis',
        role: 'moderator',
        errorType: verdict.failCodes[0] ?? 'POLICY_ERROR',
        fromModel: current.model ?? this.moderator.model,
        input: topic,
        context: transcriptContext,
        agent: this.moderator,
        ctx: roundCtx,
        failureMessage: verdict.issues.join('; '),
      });
      if (!outcome.recovered || !outcome.result) {
        throw new Error(
          `Validator 拦截圆桌最终方案: ${verdict.failCodes.join(', ') || 'UNKNOWN'} - ${verdict.issues.join('; ')}`,
        );
      }
      current = outcome.result;
    }
  }

  /**
   * Let participant executions produce Trace/Snapshot/error events without
   * spamming the roundtable UI with agent:status / agent:output events.
   */
  private wrapCtx(ctx: ExecutionContext): ExecutionContext {
    return {
      socketId: ctx.socketId,
      emit: (event, payload) => {
        if (
          event.startsWith('roundtable:') ||
          event.startsWith('rollback:') ||
          event === 'memory:updated' ||
          event === 'validator:result' ||
          event === 'agent:trace' ||
          event === 'agent:snapshot' ||
          event === 'agent:error' ||
          event === 'agent:output' ||
          event === 'agent:status'
        ) {
          ctx.emit(event, payload);
        }
      },
    };
  }
}
