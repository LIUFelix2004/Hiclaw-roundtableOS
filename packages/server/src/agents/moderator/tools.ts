export interface Tool {
  name: string;
  description?: string;
  execute(input: unknown): Promise<unknown>;
}

/**
 * Tool registry for Moderator Skill.
 * Reserved for agenda / voting / execution-status tools; Runtime injects them.
 */
const MODERATOR_TOOLS: Tool[] = [];

export function getModeratorTools(): Tool[] {
  return MODERATOR_TOOLS.map((tool) => tool);
}

export function findModeratorTool(name: string): Tool | undefined {
  return MODERATOR_TOOLS.find((tool) => tool.name === name);
}
