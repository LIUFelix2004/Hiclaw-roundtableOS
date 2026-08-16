# studio 前端 + hiclaw 后端

比赛要求围绕 hiclaw 生态，但 demo 的视觉资产（3D 像素圆桌）在 `packages/hermes-studio`。
这份文档说明两者怎么合到一起、为什么改动这么小、以及怎么起。

## 为什么前端不用改

三方共用同一份事件契约源：

- `packages/hermes-studio/vite.config.ts:48` 把 `@hermes/shared` 直接 alias 到
  `packages/shared/src`
- studio 的圆桌 store（`stores/hermes/competition-roundtable.ts`）本来就
  `emit('roundtable:start', {topic, agents, maxRounds})`，监听
  `roundtable:speech / roundtable:consensus / agent:status / agent:output`
- `hiclaw-bridge` 与 `orchestrator` 用的也是这份 `@hermes/shared`

所以不存在翻译层，只需要把 studio BFF 的转发目标从 legacy server 换成 bridge。

## 链路

```
studio client (vite 8649)
  └─ vite proxy (ws) ─→ studio BFF (8647)
       └─ handle-competition-run.ts
            HERMES_COMPETITION_BACKEND_URL  ←── 切换点
              ├─ 未设 → legacy server (8648)
              └─ 8650 → hiclaw-bridge
                          ├─ live : Orchestrator → Matrix Worker
                          └─ mock : mock-player 回放
```

## 起服务

### 演示形态（无 Matrix，完全离线）

```bash
pnpm install
cd packages/hermes-studio && npm install && cd ../..

pnpm demo
```

一条命令拉起 bridge(8650) + studio BFF(8647) + 前端(8649)，就绪后会打印入口地址。
Ctrl+C 一次性关掉全部。手动分开起也可以：

```bash
pnpm dev:bridge                      # 终端 1
cd packages/hermes-studio            # 终端 2
HERMES_COMPETITION_MODE=1 HERMES_COMPETITION_BACKEND_URL=http://127.0.0.1:8650 npm run dev
```

打开 `http://localhost:8649`，左侧「AI 圆桌」→ 输入议题 → 发起圆桌。

> 别用 `npm start` 起 studio —— 那个脚本是 `vite --port 8648`，会和 legacy
> server 的默认端口撞车。`npm run dev` 用的是 8649/8647，是安全的。

### 真实 hiclaw 链路

在 `.env` 里配齐 `HICLAW_MATRIX_*` 与 `HICLAW_WORKERS`（见 `.env.example`），
用 `pnpm demo:live` 启动（等价于去掉 `MOCK_LLM=1`），`/health` 会返回 `mode: "live"`。

任一必需项缺失、或 Matrix 登录失败，bridge 会自动降级到 mock 并在日志里说明，
不会让演示中断。

## 验收

```bash
# bridge 起着的情况下
node packages/hiclaw-bridge/smoke-test.mjs
```

按 studio 前端的真实调用方式驱动 bridge，覆盖圆桌全流程、DAG 任务、以及失败路径
是否发出 `roundtable:error`（前端靠它复位运行态）。

## 这次合并改了什么

| 文件 | 改动 |
|---|---|
| `packages/hiclaw-bridge/src/index.ts` | echo 骨架 → 真实委派 orchestrator；live/mock 双模式；失败发 `task:error` / `roundtable:error` |
| `packages/hiclaw-bridge/package.json` | 新增 `@hermes/orchestrator`、`@hermes/matrix-client` 依赖 |
| `packages/orchestrator/src/event-mapping.ts` | S2C 白名单补 `task:error`、`roundtable:error`；修复失效的编译期断言 |
| `.env.example` | 补 hiclaw / 竞赛模式环境变量 |

### 关于那个编译期断言

`event-mapping.ts` 原来用 `never` 作为不匹配的哨兵：

```ts
type _Assert<T extends true> = T;   // never extends true → 成立
```

`never` 可赋值给任何类型，所以断言永远通过 —— 白名单漏了 `task:error` 和
`roundtable:error` 也没人拦。已改为用 `false` 作哨兵并用 `[T] extends [never]`
包元组避免分布式条件类型短路。负向验证：删掉任一事件即报
`TS2344: Type 'false' does not satisfy the constraint 'true'`。

## 尚未接入

治理链路（Validator 四维校验 / Rollback 四级自愈 / Experience Memory）在
orchestrator 侧属 T5，尚未实现。bridge 收到 `rollback:respond` 只做如实回执，
不伪造恢复结果。答辩若要讲治理闭环，目前仍需走 legacy server(8648)。

## 关于 packages/web

原来仓库里有两个前端：`packages/web`（Next.js，英文）和 `packages/hermes-studio`
（Vue，中文，3D 圆桌）。因为根脚本 `dev:web` 指向前者、而 studio 从来不在
pnpm workspace 里，`pnpm dev` 一直启动的是 web，导致反复启错。

现已删除 `packages/web`，仓库只保留 studio 一个前端：

- `pnpm dev` / `pnpm dev:studio` → studio（8649）
- `pnpm dev:bridge` → hiclaw-bridge（8650）
- `pnpm dev:server` → legacy server（8648）

**注意**：治理闭环的完整可视化（DAG 画布上的回滚标记、Validator 评分卡片）
原先只在 `packages/web` 里实现，删除后这部分 UI 不复存在。studio 侧的治理呈现
走的是另一条路——BFF 把 `validator:result` 翻译成对话里的 `**Validation ✅**`
文本、`rollback:*` 翻译成 `agent.event`，只在对话视图可见，圆桌页面不显示。

代码仍在 git 历史里，需要时可从删除前的提交取回。
