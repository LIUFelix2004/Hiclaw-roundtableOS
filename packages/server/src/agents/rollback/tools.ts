export function getRollbackTools(): Array<{
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}> {
  return [
    {
      name: 'listFallbackModels',
      description: '列出当前 Agent 可用的模型回退顺序（由 Experience Memory 排序）',
      parameters: { type: 'object', properties: { role: { type: 'string' } } },
    },
    {
      name: 'restoreSnapshot',
      description: '读取指定 taskId 与 Agent 最近一次成功快照',
      parameters: {
        type: 'object',
        properties: { taskId: { type: 'string' }, role: { type: 'string' } },
      },
    },
    {
      name: 'escalateToHuman',
      description: '生成人工介入工单，包含失败原因与建议操作',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          role: { type: 'string' },
          errorType: { type: 'string' },
        },
      },
    },
  ];
}
