export interface Tool {
  name: string;
  description?: string;
  execute(input: unknown): Promise<unknown>;
}

/**
 * Tool registry for Research Skill.
 * Reserved for search / news / MCP tools; Runtime injects implementations.
 */
const RESEARCH_TOOLS: Tool[] = [];

export function getResearchTools(): Tool[] {
  return RESEARCH_TOOLS.map((tool) => tool);
}

export function findResearchTool(name: string): Tool | undefined {
  return RESEARCH_TOOLS.find((tool) => tool.name === name);
}
