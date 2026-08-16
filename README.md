# Hiclaw-roundtableOS


面向生产级多 Agent 协同的智能体操作系统。系统把自然语言任务拆解为 DAG，由多个 Skill Agent 协作执行，并通过 Validator、Rollback、Experience Memory 形成治理闭环
<img width="1920" height="879" alt="image" src="https://github.com/user-attachments/assets/1118b5d8-fd70-413e-ba99-957122d7c3e0" />
<img width="1566" height="826" alt="image" src="https://github.com/user-attachments/assets/07430285-c787-4815-8e72-7c27881438de" />


## 核心能力

- **任务拆解与调度**：Planner 以 LLM 驱动为主、规则拆解兜底，将用户请求拆为带依赖关系的子任务，Scheduler 按 DAG 并行/串行执行。
- **Skill Agent 体系**：data / research / analyst / writer / moderator / validator / rollback 均以统一 Skill 模板实现，共享 Trace、Snapshot、重试与错误分类运行时。
- **AI 圆桌引擎**：多 Agent 围绕议题多轮发言、质疑、补充，由 Moderator 收敛并输出带执行计划的共识。
- **输出防火墙**：Validator 对每个进入 DAG 状态或共识发布的产物执行四维校验，失败码与 ErrorType 对齐。
- **故障自愈**：Rollback Agent 按快照恢复、模型切换、重跑、人工兜底的顺序自动恢复失败任务。
- **经验记忆**：每次执行成功/失败写入 JSON，后续模型选择与回退顺序参考历史成功率。
- **Dashboard 数据接口**：Token、成本、健康度、圆桌统计均可通过 REST API 查询。
- **离线演示模式**：未配置模型 Key 或设置 `MOCK_LLM=1` 时，全部 Agent 使用内置中文演示数据，Demo 不依赖网络。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | hermes-studio（Vue 3 + Vite + Naive UI），含 3D 像素圆桌 |
| 后端 | Koa 2 + Socket.IO + tsx |
| 共享契约 | pnpm workspace 内 `@hermes/shared` 类型/事件协议包 |
| LLM 接入 | OpenAI / Anthropic / DeepSeek 多 Provider 路由（`LLM_PROVIDER` 或模型前缀），流式 usage 真实 Token 计数，支持按 Agent 配置模型 |
| 数据 | 内存快照 + JSON Experience Memory |

## 仓库结构

```text
hermes-agentos/
├── packages/
│   ├── hermes-studio/  # 唯一前端（Vue 3），3D 圆桌 / DAG / 对话
│   ├── hiclaw-bridge/  # hiclaw 接入桥（8650），live/mock 双模式
│   ├── orchestrator/   # hiclaw 编排：planner / scheduler / roundtable
│   ├── matrix-client/  # Matrix 协议客户端
│   ├── server/    # Koa + Socket.IO 后端
│   │   └── src/
│   │       ├── agents/          # Skill 模块（6 文件/模块）
│   │       ├── planner.ts       # 任务拆解
│   │       ├── scheduler.ts     # DAG 调度 + 输出防火墙 + Rollback 集成
│   │       ├── roundtable-engine.ts
│   │       ├── rollback-engine.ts
│   │       ├── experience-memory.ts
│   │       ├── snapshot-store.ts
│   │       ├── stats.ts
│   │       ├── demo/            # 新能源 Demo Prompt 与预置数据
│   │       └── self-test.ts     # 14 组离线自测
│   └── shared/  # 共享类型与 Socket.IO 事件协议
├── .env.example
└── pnpm-workspace.yaml
```

## 快速开始

前置要求：Node.js 20+、pnpm。

```powershell
pnpm install
Copy-Item .env.example .env
pnpm dev:server
```

未配置任何模型 Key（OpenAI / Anthropic / DeepSeek）时会自动进入 Mock 模式，服务启动于 `http://localhost:8648`。

前端（仓库只有这一个前端，`pnpm dev` 即启动它）：

```powershell
pnpm dev:studio
```

前端在 8649，studio 自带 BFF 在 8647。搭配 hiclaw 后端时另起 `pnpm dev:bridge`，
并设 `HERMES_COMPETITION_MODE=1` 与 `HERMES_COMPETITION_BACKEND_URL=http://127.0.0.1:8650`，
详见 [studio 前端 + hiclaw 后端](docs/STUDIO_ON_HICLAW.md)。

常用校验命令：

```powershell
pnpm --filter @hermes/server typecheck
pnpm --filter @hermes/server self-test
```

## 环境变量

| 变量 | 说明 | 默认 |
|---|---|---|
| `PORT` | 服务端口 | `8648` |
| `MOCK_LLM` | 置为 `1` 强制使用内置演示数据 | 自动 |
| `OPENAI_API_KEY` | 真实模型网关 Key | 无 |
| `OPENAI_BASE_URL` | OpenAI 兼容网关地址 | 无 |
| `LLM_PROVIDER` | Provider 路由：`auto` / `openai` / `anthropic` / `deepseek` | `auto` |
| `ANTHROPIC_API_KEY` | Anthropic Messages API Key | 无 |
| `ANTHROPIC_BASE_URL` | Anthropic 网关地址 | `https://api.anthropic.com` |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | 无 |
| `DEEPSEEK_BASE_URL` | DeepSeek 兼容地址 | `https://api.deepseek.com` |
| `MODEL_DATA` / `MODEL_RESEARCH` / `MODEL_ANALYST` / `MODEL_WRITER` / `MODEL_MODERATOR` / `MODEL_VALIDATOR` / `MODEL_ROLLBACK` / `MODEL_PLANNER` | 各 Agent 默认模型 | 按角色 |
| `PLANNER_LLM` | 置为 `0` 关闭 LLM 驱动的 Planner | 启用 |
| `HERMES_DATA_DIR` | Experience Memory JSON 目录 | `packages/server/data` |
| `HERMES_EXPERIENCE_FILE` | Experience Memory 文件路径 | `data/experience.json` |

## 接口

### REST

| 路径 | 说明 |
|---|---|
| `GET /health` | 服务健康检查 |
| `GET /api/stats/tokens` | Token 统计 |
| `GET /api/stats/cost` | 成本统计 |
| `GET /api/stats/health` | 运行健康度与治理指标 |
| `GET /api/stats/roundtable` | 圆桌统计 |
| `GET /api/demo` | 新能源 Demo Prompt 与预置数据 |

### Socket.IO 事件

核心事件：`task:create`、`task:plan`、`agent:status`、`agent:output`、`agent:stream`、`agent:trace`、`agent:snapshot`、`agent:error`、`validator:result`、`rollback:start`、`rollback:complete`、`rollback:human`、`memory:updated`、`roundtable:start`、`roundtable:speech`、`roundtable:consensus`。

详细协议见 [docs/API.md](docs/API.md)。

## Demo 场景

- 场景 A：DAG 协作 + 故障自愈，展示 Planner 拆解、并行执行、Validator 拦截、Rollback 切换模型、Experience Memory 沉淀。
- 场景 B：AI 圆桌辩论，展示多 Agent 多轮观点碰撞与共识收敛。

演示步骤、台词与翻车预案见 [docs/DEMO.md](docs/DEMO.md)。

## 文档索引

- [架构说明](docs/ARCHITECTURE.md)
- [接口协议](docs/API.md)
- [Demo 剧本](docs/DEMO.md)
- [答辩 PPT 提纲](docs/PPT_OUTLINE.md)

## 演进规划

当前后端以自研 AgentOS 运行时完成核心闭环；后续整体迁移至比赛指定的多 Agent 协同框架底座时，Planner/Scheduler、Skill Agent、治理闭环将作为能力层接入，接口协议保持不变。
