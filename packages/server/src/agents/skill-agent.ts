import { BaseAgent } from './base';
import { chat } from '../llm';
import { experienceMemory, type ExperienceRecordInput } from '../experience-memory';
import { snapshotStore } from '../snapshot-store';
import type {
  AgentConfig,
  AgentContext,
  AgentResult,
  ExecutionContext,
  SkillDefinition,
} from '../types';
import type {
  AgentErrorInfo,
  AgentOutput,
  AgentSnapshot,
  AgentTraceRecord,
  ErrorType,
} from '@hermes/shared';

export interface SkillValidation<TOutput extends object> {
  pass: boolean;
  output: TOutput | null;
  issues: string[];
}

/**
 * Shared runtime for Skill Agents.
 *
 * Every Skill (data / research / analyst / writer) extends this class and only
 * declares:
 * - skill.json metadata
 * - structured Prompt builder (AgentContext -> string)
 * - output validator (raw LLM text -> structured object)
 *
 * The runtime owns Trace lifecycle, Snapshot writing, retry/backoff, error
 * classification and output gates, so each Skill stays declarative.
 */
export abstract class SkillAgent<TOutput extends object = object> extends BaseAgent {
  protected abstract readonly skill: SkillDefinition;
  protected abstract buildSkillPrompt(context: AgentContext): string;
  protected abstract validateSkillOutput(raw: string): SkillValidation<TOutput>;

  getSkill(): SkillDefinition {
    return this.skill;
  }

  // Legacy compatibility shim for the old BaseAgent contract. New Skills
  // always build prompts from AgentContext.
  buildPrompt(task: string, context: string): string {
    return this.buildSkillPrompt({
      taskId: 'legacy',
      task,
      inputData: context,
      previousResults: [],
    });
  }

  async execute(
    taskId: string,
    _taskTitle: string,
    input: string,
    context: string,
    ctx: ExecutionContext,
    modelOverride?: string,
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const traceId = `trace_${taskId}_${Date.now()}`;
    const snapshotId = `snap_${taskId}_${Date.now()}`;
    const selectedModel = modelOverride ?? experienceMemory.pickModel(this.role, this.skill.taskType);

    const agentContext: AgentContext = {
      taskId,
      task: input,
      inputData: context,
      previousResults: parsePreviousResults(context),
      memory: null,
      snapshotId,
      traceId,
    };

    this.emitStatus(taskId, 'running', 0, ctx, selectedModel);
    this.emitTrace(ctx, {
      traceId,
      agent: this.role,
      model: selectedModel,
      status: 'running',
      phase: 'START',
    });
    this.emitSnapshot(ctx, {
      snapshotId,
      taskId,
      agent: this.role,
      timestamp: Date.now(),
      input: agentContext,
      model: selectedModel,
      status: 'running',
    });
    snapshotStore.save({
      snapshotId,
      taskId,
      agent: this.role,
      timestamp: Date.now(),
      input: agentContext,
      model: selectedModel,
      status: 'running',
    });

    const prompt = this.buildSkillPrompt(agentContext);
    this.emitTrace(ctx, {
      traceId,
      agent: this.role,
      model: selectedModel,
      status: 'running',
      phase: 'CONTEXT_BUILD',
    });
    this.emitTrace(ctx, {
      traceId,
      agent: this.role,
      model: selectedModel,
      status: 'running',
      phase: 'MODEL_SELECTED',
    });

    const attempts = this.config.retryCount + 1;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const result = await chat({
          role: this.role,
          model: selectedModel,
          systemPrompt: this.config.systemPrompt,
          messages: [{ role: 'user', content: prompt }],
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens,
          timeoutMs: this.config.timeout,
          onChunk: (chunk) => {
            ctx.emit('agent:stream', {
              taskId,
              agent: this.role,
              chunk,
            } as any);
          },
        });

        this.emitTrace(ctx, {
          traceId,
          agent: this.role,
          model: result.model,
          provider: result.provider,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          tokens: result.tokens,
          cost: result.cost,
          status: 'running',
          phase: 'LLM_CALL',
          attempt,
        });
        this.emitTrace(ctx, {
          traceId,
          agent: this.role,
          model: result.model,
          status: 'running',
          phase: 'OUTPUT_VALIDATE',
        });

        const validation = this.validateSkillOutput(result.content);
        if (!validation.pass) {
          throw new Error(
            `${this.role} 输出未通过 Schema 校验: ${validation.issues.join('; ')}`,
          );
        }
        const validOutput = validation.output as TOutput;

        const duration = Date.now() - startTime;
        const output: AgentOutput = {
          taskId,
          agent: this.role,
          content: JSON.stringify(validOutput),
          tokens: result.tokens,
          cost: result.cost,
          duration,
          model: result.model,
          provider: result.provider,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        };
        ctx.emit('agent:output', output);

        this.emitSnapshot(ctx, {
          snapshotId,
          taskId,
          agent: this.role,
          timestamp: Date.now(),
          input: agentContext,
          output: validOutput,
          model: result.model,
          status: 'success',
        });
        snapshotStore.save({
          snapshotId,
          taskId,
          agent: this.role,
          timestamp: Date.now(),
          input: agentContext,
          output: validOutput,
          model: result.model,
          status: 'success',
        });
        this.emitTrace(ctx, {
          traceId,
          agent: this.role,
          model: result.model,
          provider: result.provider,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          tokens: result.tokens,
          cost: result.cost,
          duration,
          status: 'success',
          phase: 'SUCCESS',
        });
        this.emitStatus(taskId, 'success', 100, ctx, result.model);
        await this.recordExperience(ctx, {
          taskType: this.skill.taskType,
          agent: this.role,
          model: result.model,
          success: true,
        });

        return {
          taskId,
          role: this.role,
          output: JSON.stringify(validOutput),
          tokens: result.tokens,
          cost: result.cost,
          duration,
          model: result.model,
          provider: result.provider,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        };
      } catch (err: any) {
        err.model = selectedModel;
        lastError = err;
        const errorType = classifyError(err);
        const errorMessage = `${errorType}: ${err?.message ?? err}`;

        this.emitSnapshot(ctx, {
          snapshotId,
          taskId,
          agent: this.role,
          timestamp: Date.now(),
          input: agentContext,
          model: selectedModel,
          status: 'failed',
          error: { errorType, message: err?.message ?? String(err) },
        });
        snapshotStore.save({
          snapshotId,
          taskId,
          agent: this.role,
          timestamp: Date.now(),
          input: agentContext,
          model: selectedModel,
          status: 'failed',
          error: { errorType, message: err?.message ?? String(err) },
        });
        this.emitTrace(ctx, {
          traceId,
          agent: this.role,
          model: selectedModel,
          status: 'failed',
          phase: 'FAIL',
          attempt,
          message: errorMessage,
        });

        const waitMs = 400 * attempt;
        console.warn(
          `[${this.role}] attempt ${attempt}/${attempts} failed: ${errorMessage} (retry in ${waitMs}ms)`,
        );
        if (attempt < attempts) {
          this.emitStatus(taskId, 'running', Math.round((attempt / attempts) * 80), ctx, selectedModel);
          await sleep(waitMs);
        }
      }
    }

    const errorType = classifyError(lastError);
    const message = `${this.role} 在 ${attempts} 次尝试后失败 [${errorType}]: ${(lastError as any)?.message ?? lastError}`;
    await this.recordExperience(ctx, {
      taskType: this.skill.taskType,
      agent: this.role,
      model: selectedModel,
      success: false,
      failReason: message,
    });
    const errorInfo: AgentErrorInfo = {
      taskId,
      agent: this.role,
      errorType,
      message,
    };
    this.emitStatus(taskId, 'failed', 0, ctx);
    ctx.emit('agent:error', errorInfo);
    throw new Error(message);
  }

  private async recordExperience(
    ctx: ExecutionContext,
    input: ExperienceRecordInput,
  ): Promise<void> {
    try {
      const record = await experienceMemory.record(input);
      ctx.emit('memory:updated', record);
    } catch (err: any) {
      console.warn(`[experience-memory] 写入失败: ${err?.message ?? err}`);
    }
  }
}

export function classifyError(err: unknown): ErrorType {
  const message = `${(err as any)?.message ?? err}`.toLowerCase();
  if (
    /timeout|network|econn|abort|rate.?limit|api key|401|429|500|502|503/.test(message)
  ) {
    return 'MODEL_ERROR';
  }
  if (/mcp|tool|database|search|fetch/.test(message)) {
    return 'TOOL_ERROR';
  }
  if (/permission|forbidden|denied|policy|schema/.test(message)) {
    return 'POLICY_ERROR';
  }
  return 'DATA_ERROR';
}

export function parsePreviousResults(
  context: string,
): Array<{ agent: string; result: unknown }> {
  if (!context) return [];
  const parts = context.split(/--- Output from /g).slice(1);
  return parts.map((part) => {
    const [header, ...bodyLines] = part.trim().split('\n');
    const agent = header?.split(']')[0]?.replace('[', '').trim() || 'unknown';
    const raw = bodyLines.join('\n').trim();
    return { agent, result: tryParseJson(raw) ?? raw };
  });
}

function tryParseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
