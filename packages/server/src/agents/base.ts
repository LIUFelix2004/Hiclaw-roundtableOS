import type { AgentRole, AgentOutput } from '@hermes/shared';
import type { AgentConfig, AgentResult, ExecutionContext } from '../types';
import { chat } from '../llm';

export abstract class BaseAgent {
  protected config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  get role(): AgentRole {
    return this.config.role;
  }

  get model(): string {
    return this.config.model;
  }

  abstract buildPrompt(task: string, context: string): string;

  async execute(
    taskId: string,
    taskTitle: string,
    input: string,
    context: string,
    ctx: ExecutionContext,
  ): Promise<AgentResult> {
    const startTime = Date.now();

    this.emitStatus(taskId, 'running', 0, ctx);

    const prompt = this.buildPrompt(input, context);
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

        const output: AgentOutput = {
          taskId,
          agent: this.role,
          content: result.content,
          tokens: result.tokens,
          cost: result.cost,
          duration: Date.now() - startTime,
        };
        ctx.emit('agent:output', output);
        this.emitStatus(taskId, 'success', 100, ctx);

        return {
          taskId,
          role: this.role,
          output: result.content,
          tokens: result.tokens,
          cost: result.cost,
          duration: Date.now() - startTime,
        };
      } catch (err: any) {
        lastError = err;
        const waitMs = 400 * attempt;
        console.warn(
          `[agent:${this.role}] attempt ${attempt}/${attempts} failed: ${err?.message ?? err} (retry in ${waitMs}ms)`,
        );
        if (attempt < attempts) {
          this.emitStatus(taskId, 'running', Math.round((attempt / attempts) * 80), ctx);
          await sleep(waitMs);
        }
      }
    }

    // Final failure: emit failed status + error event, then propagate so the
    // scheduler does not treat an error payload as a successful result.
    const message = `Agent ${this.role} failed after ${attempts} attempts: ${(lastError as any)?.message ?? lastError}`;
    this.emitStatus(taskId, 'failed', 0, ctx);
    ctx.emit('error', { message });
    throw new Error(message);
  }

  private emitStatus(taskId: string, status: 'pending' | 'running' | 'success' | 'failed' | 'rollback', progress: number, ctx: ExecutionContext) {
    ctx.emit('agent:status', {
      taskId,
      agent: this.role,
      status,
      progress,
      model: this.model,
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
