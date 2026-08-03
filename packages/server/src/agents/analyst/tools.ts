export interface Tool {
  name: string;
  description?: string;
  execute(input: unknown): Promise<unknown>;
}

/**
 * Tool registry for Analyst Skill.
 * Current phase keeps the interface ready for MCP / database / search /
 * calculator tools; Runtime injects tools instead of the Skill hardcoding
 * concrete implementations.
 */
const ANALYST_TOOLS: Tool[] = [];

export function getAnalystTools(): Tool[] {
  return ANALYST_TOOLS.map((tool) => tool);
}

export function findAnalystTool(name: string): Tool | undefined {
  return ANALYST_TOOLS.find((tool) => tool.name === name);
}
