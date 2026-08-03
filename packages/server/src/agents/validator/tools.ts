export interface Tool {
  name: string;
  description?: string;
  execute(input: unknown): Promise<unknown>;
}

/**
 * Tool registry for Validator Skill.
 * Reserved for deterministic security scanners (PII / secret / injection
 * patterns) and schema engines; Runtime injects them.
 */
const VALIDATOR_TOOLS: Tool[] = [];

export function getValidatorTools(): Tool[] {
  return VALIDATOR_TOOLS.map((tool) => tool);
}

export function findValidatorTool(name: string): Tool | undefined {
  return VALIDATOR_TOOLS.find((tool) => tool.name === name);
}
