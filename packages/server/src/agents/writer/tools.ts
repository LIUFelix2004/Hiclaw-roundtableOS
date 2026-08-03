export interface Tool {
  name: string;
  description?: string;
  execute(input: unknown): Promise<unknown>;
}

/**
 * Tool registry for Writer Skill.
 * Reserved for document rendering / citation / fact-check tools.
 */
const WRITER_TOOLS: Tool[] = [];

export function getWriterTools(): Tool[] {
  return WRITER_TOOLS.map((tool) => tool);
}

export function findWriterTool(name: string): Tool | undefined {
  return WRITER_TOOLS.find((tool) => tool.name === name);
}
