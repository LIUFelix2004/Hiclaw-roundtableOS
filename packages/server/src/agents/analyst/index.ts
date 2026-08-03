import { BaseAgent } from '../base';
import { chat } from '../../llm';
import skillJson from './skill.json';
import { SYSTEM_PROMPT, buildAnalystPrompt } from './prompt';
import { validateAnalystOutput } from './validator';
import { getAnalystTools } from './tools';
import type {
  AgentConfig,
  AgentContext,
  AgentResult,
  ExecutionContext,
  SkillDefinition,
} from '../../types';
import type {
  AgentErrorInfo,
  AgentOutput,
  AgentSnapshot,
  AgentTraceRecord,
  ErrorType,
} from '@hermes/shared';

const SKILL = skillJson as unknown as SkillDefinition;

/**
 * Analyst Skill v1.0
 *
 * Production-grade Skill Agent:
 * - declares Skill metadata (skill.json) for Runtime versioning
 * - consumes structured AgentContext instead of `(task, context)` strings
 * - emits JSON matching AnalystOutput schema, validated before output
 * - declares model "auto" and leaves routing to NewAPI/Runtime
 * - emits Trace lifecycle + input/output/error Snapshots for Rollback
 * - classifies failures into DATA / MODEL / TOOL / POLICY errors
 */
export class AnalystAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      role: 'analyst',
      model: 'auto',
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.3,
      maxTokens: 4096,
      retryCount: 2,
      timeout: 60000,
    };
    super(config);
  }

  getSkill(): SkillDefinition {
    return SKILL;
  }

  // Legacy compatibility shim; the real execution path uses
  // buildAnalystPrompt(AgentContext).
  buildPrompt(task: string, context: string): string {
    return buildAnalystPrompt({
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
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const traceId = `trace_${taskId}_${Date.now()}`;
    const snapshotId = `snap_${taskId}_${Date.now()}`;

    const agentContext: AgentContext = {
      taskId,
      task: input,
      inputData: context,
      previousResults: parsePreviousResults(context),
      memory: null,
      snapshotId,
      traceId,
    };

    this.emitStatus(taskId, 'running', 0, ctx);
    this.emitTrace(ctx, {
      traceId,
      agent: this.role,
      model: 'auto',
      status: 'running',
      phase: 'START',
    });
    this.emitSnapshot(ctx, {
      snapshotId,
      agent: this.role,
      timestamp: Date.now(),
      input: agentContext,
      model: 'auto',
      status: 'running',
    });

    const prompt = buildAnalystPrompt(agentContext);
    this.emitTrace(ctx, {
      traceId,
      agent: this.role,
      model: 'auto',
      status: 'running',
      phase: 'CONTEXT_BUILD',
    });
    this.emitTrace(ctx, {
      traceId,
      agent: this.role,
      model: 'auto',
      status: 'running',
      phase: 'MODEL_SELECTED',
    });

    const attempts = this.config.retryCount + 1;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const result = await chat({
          role: this.role,
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

        const validation = validateAnalystOutput(result.content);
        if (!validation.pass) {
          throw new Error(`Analyst 输出未通过 Schema 校验: ${validation.issues.join('; ')}`);
        }

        const duration = Date.now() - startTime;
        const output: AgentOutput = {
          taskId,
          agent: this.role,
          content: JSON.stringify(validation.output),
          tokens: result.tokens,
          cost: result.cost,
          duration,
        };
        ctx.emit('agent:output', output);

        const snapshot: AgentSnapshot = {
          snapshotId,
          agent: this.role,
          timestamp: Date.now(),
          input: agentContext,
          output: validation.output,
          model: result.model,
          status: 'success',
        };
        this.emitSnapshot(ctx, snapshot);
        this.emitTrace(ctx, {
          traceId,
          agent: this.role,
          model: result.model,
          tokens: result.tokens,
          cost: result.cost,
          duration,
          status: 'success',
          phase: 'SUCCESS',
        });
        this.emitStatus(taskId, 'success', 100, ctx);

        return {
          taskId,
          role: this.role,
          output: JSON.stringify(validation.output),
          tokens: result.tokens,
          cost: result.cost,
          duration,
        };
      } catch (err: any) {
        lastError = err;
        const errorType = classifyError(err);
        const errorMessage = `${errorType}: ${err?.message ?? err}`;

        this.emitSnapshot(ctx, {
          snapshotId,
          agent: this.role,
          timestamp: Date.now(),
          input: agentContext,
          model: this.model,
          status: 'failed',
          error: { errorType, message: err?.message ?? String(err) },
        });
        this.emitTrace(ctx, {
          traceId,
          agent: this.role,
          model: this.model,
          status: 'failed',
          phase: 'FAIL',
          attempt,
          message: errorMessage,
        });

        const waitMs = 400 * attempt;
        console.warn(`[analyst] attempt ${attempt}/${attempts} failed: ${errorMessage} (retry in ${waitMs}ms)`);
        if (attempt < attempts) {
          this.emitStatus(taskId, 'running', Math.round((attempt / attempts) * 80), ctx);
          await sleep(waitMs);
        }
      }
    }

    const errorType = classifyError(lastError);
    const message = `Analyst 在 ${attempts} 次尝试后失败 [${errorType}]: ${(lastError as any)?.message ?? lastError}`;
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
}

function classifyError(err: unknown): ErrorType {
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

function parsePreviousResults(
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

export { getAnalystTools };
