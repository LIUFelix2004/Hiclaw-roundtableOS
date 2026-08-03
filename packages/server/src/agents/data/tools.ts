export interface Tool {
  name: string;
  description?: string;
  execute(input: unknown): Promise<unknown>;
}

/**
 * Tool registry for Data Skill.
 * Reserved for MCP / database / search / financial-data tools; the Runtime
 * injects tool implementations instead of the Skill hardcoding them.
 */
const DATA_TOOLS: Tool[] = [];

export function getDataTools(): Tool[] {
  return DATA_TOOLS.map((tool) => tool);
}

export function findDataTool(name: string): Tool | undefined {
  return DATA_TOOLS.find((tool) => tool.name === name);
}
