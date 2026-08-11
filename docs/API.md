# Hermes AgentOS 接口协议

## 1. 基础信息

| 项目 | 值 |
|---|---|
| 服务地址 | `http://localhost:8648` |
| 端口 | 环境变量 `PORT`，默认 `8648` |
| REST | Koa |
| 实时通信 | Socket.IO，默认命名空间 `/`，CORS `*` |
| 契约源 | `packages/shared/src/types.ts`、`packages/shared/src/events.ts` |

前后端必须从 `@hermes/shared` 导入类型，不自行定义重复协议。

## 2. REST 接口

### `GET /health`

服务健康检查。

```json
{
  "status": "ok",
  "service": "hermes-agentos-server",
  "mock": true,
  "provider": "openai",
  "uptime": 12.34
}
```

### `GET /api/stats/tokens`

Token 消耗统计。

```json
{
  "total": 1200,
  "byAgent": { "data": 300, "analyst": 500, "writer": 400 },
  "recent": [
    {
      "taskId": "task_1720000000000",
      "agent": "analyst",
      "tokens": 500,
      "cost": 0.0012,
      "timestamp": 1720000000000
    }
  ]
}
```

### `GET /api/stats/cost`

模型调用成本统计。

```json
{
  "total": 0.0034,
  "byModel": { "gpt-4o": 0.0022, "gpt-4o-mini": 0.0012 },
  "recent": [
    {
      "taskId": "task_1720000000000",
      "agent": "analyst",
      "model": "gpt-4o",
      "tokens": 500,
      "cost": 0.0012,
      "timestamp": 1720000000000
    }
  ]
}
```

### `GET /api/stats/health`

运行健康度与治理指标。

```json
{
  "status": "ok",
  "service": "hermes-agentos-server",
  "mock": true,
  "uptime": 60,
  "activeTasks": 1,
  "activeRoundtables": 0,
  "snapshotCount": 12,
  "memoryRecords": 20,
  "failures": 1,
  "rollbackRecovered": 1,
  "rollbackEscalated": 0,
  "lastError": "可选：最近一次错误信息"
}
```

### `GET /api/stats/roundtable`

圆桌统计。

```json
{
  "total": 1,
  "rounds": 3,
  "topics": [
    {
      "topic": "新能源企业应该优先布局储能还是光伏？",
      "rounds": 3,
      "timestamp": 1720000000000
    }
  ],
  "lastConsensus": {
    "rounds": 3,
    "finalAnswer": "...",
    "agreements": [],
    "disagreements": []
  }
}
```

### `GET /api/demo`

新能源 Demo Prompt 与预置数据。

```json
{
  "prompts": [
    {
      "id": "new-energy-weekly",
      "title": "新能源行业战略分析周报",
      "type": "task",
      "prompt": "生成一份新能源行业战略分析周报..."
    }
  ],
  "dataset": {
    "period": "2026-07-27 至 2026-08-02",
    "storage": { "gwh": 42.6, "yoy": 0.583 },
    "solar": { "gw": 128, "yoy": 0.124 },
    "ev": { "penetration": 0.547 }
  }
}
```

## 3. Socket.IO 客户端 → 服务端

### `task:create`

发起一次 DAG 协作任务。

```json
{
  "message": "生成一份新能源行业战略分析周报"
}
```

### `roundtable:start`

发起圆桌讨论。

```json
{
  "topic": "新能源企业应该优先布局储能还是光伏？",
  "agents": ["data", "research", "analyst", "writer"],
  "maxRounds": 2
}
```

`maxRounds` 范围 1-3，默认 3。

## 4. Socket.IO 服务端 → 客户端

### `task:plan`

Planner 拆解结果，前端用于渲染 DAG。

```json
{
  "tasks": [
    {
      "id": "uuid",
      "title": "Gather Data",
      "agent": "data",
      "dependsOn": [],
      "status": "pending"
    }
  ],
  "reasoning": "先收集数据，再研究与分析，最后成稿",
  "source": "llm"
}
```

`source` 取值：`llm`（LLM Planner 拆解）或 `rules`（规则兜底 / 离线 Mock）。

### `agent:status`

Agent 执行状态。

```json
{
  "taskId": "task_1720000000000",
  "agent": "analyst",
  "status": "running",
  "progress": 40,
  "model": "gpt-4o"
}
```

`status` 枚举：`pending | running | success | failed | rollback`。

### `agent:output`

Agent 结构化输出。

```json
{
  "taskId": "task_1720000000000",
  "agent": "analyst",
  "content": "{\"summary\":\"...\"}",
  "tokens": 500,
  "cost": 0.0012,
  "duration": 3200,
  "model": "gpt-4o",
  "provider": "openai",
  "inputTokens": 240,
  "outputTokens": 260
}
```

`provider` 取值：`openai | anthropic | deepseek | mock`；真实模型调用时 `inputTokens / outputTokens` 来自 API usage，Mock 或网关未返回 usage 时为估算值。

### `agent:stream`

流式增量文本。

```json
{
  "taskId": "task_1720000000000",
  "agent": "analyst",
  "chunk": "行业处于"
}
```

### `agent:trace`

全链路 Trace 阶段。

```json
{
  "traceId": "trace_task_1720000000000_1720000000000",
  "agent": "analyst",
  "model": "gpt-4o",
  "provider": "openai",
  "inputTokens": 240,
  "outputTokens": 260,
  "tokens": 500,
  "cost": 0.0012,
  "duration": 3200,
  "status": "success",
  "phase": "SUCCESS",
  "attempt": 1,
  "message": "可选信息"
}
```

`phase` 枚举：`START | CONTEXT_BUILD | MODEL_SELECTED | LLM_CALL | OUTPUT_VALIDATE | SNAPSHOT | SUCCESS | FAIL`。

### `agent:snapshot`

执行快照。

```json
{
  "snapshotId": "snap_task_1720000000000_1720000000000",
  "taskId": "task_1720000000000",
  "agent": "analyst",
  "timestamp": 1720000000000,
  "input": {},
  "output": {},
  "model": "gpt-4o",
  "status": "success"
}
```

### `agent:error`

Agent 失败信息。

```json
{
  "taskId": "task_1720000000000",
  "agent": "analyst",
  "errorType": "MODEL_ERROR",
  "message": "analyst 在 3 次尝试后失败 [MODEL_ERROR]: timeout"
}
```

### `validator:result`

输出防火墙判定。

```json
{
  "taskId": "task_1720000000000",
  "agent": "analyst",
  "pass": false,
  "scores": {
    "accuracy": 0.2,
    "completeness": 0.5,
    "safety": 0.7,
    "format": 0.4
  },
  "failCodes": ["DATA_ERROR", "MODEL_ERROR"],
  "issues": ["候选输出包含 FAIL_INJECT 标记"],
  "reason": "候选输出包含 FAIL_INJECT 标记"
}
```

### `rollback:start`

Rollback 开始，前端用于触发故障恢复动画。

```json
{
  "taskId": "task_1720000000000",
  "errorType": "MODEL_ERROR",
  "fromModel": "gpt-4o",
  "toModel": "gpt-4o-mini"
}
```

### `rollback:complete`

Rollback 结果。

```json
{
  "taskId": "task_1720000000000",
  "agent": "analyst",
  "errorType": "MODEL_ERROR",
  "fromModel": "gpt-4o",
  "toModel": "gpt-4o-mini",
  "strategy": "model_switch",
  "recovered": true,
  "attempts": 1,
  "reason": "切换到历史成功率更优的模型 gpt-4o-mini 并重跑",
  "duration": 1200
}
```

`strategy` 枚举：`snapshot_restore | model_switch | rerun | human_escalation`。

### `rollback:human`

人工兜底工单。

```json
{
  "taskId": "task_1720000000000",
  "agent": "analyst",
  "errorType": "POLICY_ERROR",
  "message": "Rollback 无法自动恢复 analyst 任务",
  "instructions": "请人工检查失败原因与任务输入，修复后重试"
}
```

### `memory:updated`

Experience Memory 新增记录。

```json
{
  "id": "uuid",
  "taskType": "industry-analysis",
  "agent": "analyst",
  "model": "gpt-4o",
  "success": true,
  "failReason": "可选：失败原因",
  "timestamp": 1720000000000
}
```

### `roundtable:speech`

圆桌单次发言。

```json
{
  "round": 1,
  "agent": "analyst",
  "model": "gpt-4o",
  "content": "{\"summary\":\"...\"}",
  "stance": "propose"
}
```

`stance` 枚举：`propose | agree | challenge | supplement | moderate | synthesize`。

### `roundtable:consensus`

圆桌共识。

```json
{
  "rounds": 2,
  "finalAnswer": "第一阶段优先布局储能...",
  "agreements": ["data: 提供储能数据"],
  "disagreements": ["储能价格战风险"],
  "finalSolution": "第一阶段优先布局储能...",
  "executionTasks": [
    {
      "agent": "data",
      "objective": "补充储能订单与政策数据",
      "input": "储能产业链",
      "expectedOutput": "结构化数据 JSON",
      "deadline": "T+1"
    }
  ],
  "risks": ["储能价格战"]
}
```

### `error`

通用错误事件。

```json
{
  "message": "Task failed: ..."
}
```

## 5. 事件顺序

### DAG 协作

```text
task:create
  → task:plan
  → 每层任务：
      agent:status（running）
      agent:stream（可选）
      agent:trace
      agent:snapshot
      agent:output
      validator:result
      （失败时）rollback:start → rollback:complete / rollback:human
      memory:updated
  → agent:output（最终汇总）
```

### 圆桌讨论

```text
roundtable:start
  → roundtable:speech（round 0，Moderator 目标确认）
  → round 1..maxRounds：参与者 roundtable:speech
  → Moderator 合成
  → validator:result
  → （失败时）rollback 系列事件
  → roundtable:consensus
```

## 6. 错误与限制

- LLM Provider 通过 `LLM_PROVIDER=auto|openai|anthropic|deepseek` 或模型前缀（如 `deepseek:deepseek-chat`、`anthropic:claude-sonnet-4-20250514`）路由；`auto` 按已配置 Key 顺序选择 Anthropic > DeepSeek > OpenAI。
- 同一 Socket 连接同一时间只允许一个 `task:create` 或 `roundtable:start` 运行，重复发起会收到 `error`。
- Validator 连续失败且 Rollback 无法恢复时，任务失败并发出 `rollback:human`，不会把失败产物写入 DAG 状态。
- 未配置任何模型 Key 时自动进入 Mock 模式；`MOCK_LLM=1` 可强制 Mock。
