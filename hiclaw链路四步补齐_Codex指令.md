# hiclaw 链路四步补齐 — Codex 指令

> 目标：把 `NEXT_PUBLIC_BACKEND=hiclaw` 这条链路从「连得上但什么都不出」打通到「端到端可演示」。
> 分支：在 `main` 上新开 `feat/hiclaw-e2e`
> 配套文档：根目录 `T2.2_ChatView_hiclaw_Codex指令.md`（第四步的详细拆解在那里）

---

## 零、动手前必读

这四步里前三步是后端、互相独立，第四步是前端且**依赖第一步**。建议顺序执行，
第一步做完就能本地看到事件流，后面三步都有东西可验证。

**不要照搬任务清单里的措辞**，以下是核实过的现状：

- `packages/web/src/components/chat/ChatView.tsx` **不是空的**，A-04 已完成约八成
  （任务卡片、流式追加、Markdown 渲染、错误条、状态栏、回滚提示都在）。第四步是补缺口，不是重写。
- `packages/hiclaw-bridge/src/mock-player.ts` **已完成（407 行）**，不需要你写。
  缺的只是把它接进 `index.ts`。
- 这四步**全部不需要任何凭据**，`MOCK_LLM` 路径就能跑完整个验收。

---

## 第一步 · 把 mock-player 接进桥

**文件**：`packages/hiclaw-bridge/src/index.ts`

现状：`task:create` / `roundtable:start` / `rollback:respond` 三个 handler 收到消息后
只回一条 `bridge:echo`（`index.ts:45-70`），**从不发 `task:plan` / `agent:stream` /
`agent:output`**。所以现在把前端切到 hiclaw 模式界面必然一片空白——这不是前端 bug。

同目录的 `mock-player.ts` 导出：

```ts
export type EmitFn = (event: string, payload: unknown) => void;
export async function playTask(message: string, emit: EmitFn): Promise<void>;
export async function playRoundtable(config: RoundtableConfig, emit: EmitFn): Promise<void>;
```

它依次发出 `task:plan` → `agent:status` → `agent:stream` → `agent:output` →
`validator:result` → 汇总 `agent:output`，与 legacy 8648 在 `MOCK_LLM=1` 下的输出逐字节一致。

**要做的**：

1. `task:create` 改为调用 `playTask(data.message, emit)`，`roundtable:start` 改为调用
   `playRoundtable(data, emit)`。`bridge:echo` 保留作为连接确认，`bridge:heartbeat` 不动。
2. `emit` 实现为 `(event, payload) => socket.emit(event as never, payload as never)`。
3. 用 try/catch 包住，失败时 `socket.emit('task:error', { message })`
   （圆桌路径用 `roundtable:error`）。
4. 加 per-socket 的「同时只跑一个任务」保护，与 legacy `packages/server/src/index.ts:93-101`
   的 `activeTasks` 逻辑对齐：重复提交时回 `task:error`，`finally` 里删除，
   `disconnect` 时也要清理。圆桌单独一个 `activeRoundtables`。
5. `/health` 里的 `mode: 'echo'` 改成能反映真实状态的值（如 `'mock-player'`）。

**顺带修一处不一致**：`mock-player.ts:271` 的 `emit('error', ...)`（调度死锁分支）
应改为 `emit('task:error', ...)`。原因见下面「五、事件契约」。

**验证**：

```bash
pnpm --filter @hermes/hiclaw-bridge dev     # 8650
```

另开一个 node 脚本用 `socket.io-client` 连 8650 发一条 `task:create`，
确认收到 `task:plan` 与若干 `agent:stream`，且第二条 `task:create` 立刻收到 `task:error`。

---

## 第二步 · 修掉网关的静默 mock 回退

**文件**：`packages/orchestrator/src/llm.ts:45-47`

```ts
export function isGatewayMockEnabled(): boolean {
  return process.env.MOCK_LLM === '1' || !gatewayApiKey();
}
```

问题：key 没配（或配错名字、有空格、粘贴时被截断）时，系统**不报错、不告警**，
直接回退到离线兜底数据。界面照常滚动、照常出结果，演示时看起来完全正常，
但一个真实模型调用都没发生。这是路演级别的事故风险。

`packages/server/src/llm.ts` 上的同型陷阱已经修过了（`f998a4f`），照那个形状改：

1. 保留 `MOCK_LLM=1` 显式强制 mock 的行为——这是合法用法。
2. **key 缺失导致的 mock 必须是可见的**：进程启动时打一条醒目的 warn 日志，说明
   「`HICLAW_GATEWAY_KEY` 未配置，orchestrator 运行在离线兜底模式，不会发生真实模型调用」。
3. 暴露一个 `gatewayMode(): 'mock' | 'live'`（或等价物），并在 orchestrator 的健康检查/
   启动日志里输出。要能一眼看出当前到底走没走网关。
4. `gatewayChat()` 在 live 模式下若拿到 401/403，错误信息里明确提示
   「网关 key 无效或未在 Higress 注册为 consumer」——不要让它退化成一句裸的
   `AI 网关调用失败（401）`。

**不要**改成「key 缺失就抛异常」。离线兜底是刻意保留的降级路径，只是必须吵。

**验证**：不设 `HICLAW_GATEWAY_KEY` 启动 orchestrator，确认日志里有 warn；
设一个假 key 并让 `HICLAW_GATEWAY_BASE_URL` 指向一个会返回 401 的地址，
确认错误信息里有 consumer 提示。

---

## 第三步 · 修 Worker 回复错配竞态

**文件**：`packages/orchestrator/src/orchestrator.ts:185-193`，`packages/orchestrator/src/task-protocol.ts`

现状：

```ts
/** Worker 文本回复处理：按 sender 匹配最早的未决直派请求并 resolve / emit */
private handleWorkerReply(msg: MatrixRoomMessage): void {
  if (msg.roomId !== this.roomId) return;
  for (const [id, pd] of this.pending) {
    if (pd.workerUserId !== msg.sender) continue;   // ← 只按 sender 匹配
    clearTimeout(pd.timer);
    this.pending.delete(id);
    pd.resolve(msg.body);                            // ← 取 Map 中最早的一条
    return;
  }
  ...
}
```

`runParallel()`（`orchestrator.ts:118`）会同时派发多个任务。当两个并发任务命中**同一个
角色 / 同一个 Worker** 时，`this.pending` 里会有两条 `workerUserId` 相同的记录，
而 Matrix 回复是**乱序到达**的——先回来的那条会被 resolve 给最早入队的请求。
结果：A 任务拿到 B 的产出。这个 bug 不会抛错、不会超时，只会安静地把内容串位，
在 DAG 下游被当成正确的上游输出继续传播。

**要做的**：让匹配走 `taskId`，而不是 sender + 入队顺序。

1. `task-protocol.ts` 的输出契约（`buildTaskBody`，第 72-80 行那段 `<输出契约>`）里，
   把 `taskId` 加成**必填回传字段**：

   ```
   {
     "taskId": "原样回传收到的 taskId",
     "content": "...",
     "usage": { ... }
   }
   ```

   正文开头已经有 `taskId: ${input.taskId}`（`:49`），Worker 拿得到。

2. `WorkerStructuredResult` 增加 `taskId?: string`，`parseWorkerResult()` 解析它。
   解析不到时保持 `undefined`，**不要抛错**。

3. `handleWorkerReply` 改为两级匹配：
   - **优先**：解析 `msg.body`，若拿到 `taskId` 且 `pending` 中有对应项 → 精确匹配。
   - **回退**：拿不到 `taskId` 时，才退回现有的「按 sender 取最早」逻辑，
     但此时打一条 warn 日志说明发生了模糊匹配。老 Worker / 不守契约的模型仍能工作。
   - `pending` 的 key 目前是自增 `id`（`:159`），精确匹配需要能按 `taskId` 反查。
     加一个 `taskId → id` 的索引，或直接把 `pending` 的 key 换成 `taskId`
     （注意 `dispatchTask` 的 `taskId` 有默认值 `task-${++this.seq}`，天然唯一）。

4. `pd.resolve(msg.body)` 传的是原始文本，调用方再 `parseWorkerResult` 一次
   （见 `roundtable.ts:104`）。你在匹配时已经解析过一次了——**不要**改 resolve 的签名去
   传解析结果，那会牵动 `roundtable.ts` 和 `pipeline.ts` 两个调用点；解析两次的开销可忽略。

**验证**：写一个单测，构造两个 `workerUserId` 相同的并发 `dispatchTask`，
让 mock 的 Matrix client **逆序**返回两条带 `taskId` 的回复，断言各自 resolve 到正确的那条。
再补一个不带 `taskId` 的回复用例，断言回退路径仍能 resolve 且打了 warn。

---

## 第四步 · ChatView hiclaw 模式渲染

**完整拆解见根目录 `T2.2_ChatView_hiclaw_Codex指令.md` 的 Step 1–5。**
那份文档里的 Step 0 就是本文档的第一步，**做完第一步后跳过它，直接从 Step 1 开始**。

五个子项摘要（细节以那份文档为准）：

1. 后端模式徽章 —— `socket.ts` 导出 `BACKEND_MODE` / `BACKEND_URL`，header 显示
   `hiclaw · :8650` / `legacy · :8648`
2. 连接态与桥事件 —— `isConnected` 驱动输入禁用、断连提示条、订阅 `bridge:echo`
3. `task:plan` 补齐 `source`（`LLM 规划` / `规则拆解` 徽章）与可折叠的 `reasoning`
4. 新建 `ValidatorCard.tsx` 渲染 `validator:result` 四维评分
5. 流式渲染节流（80–120ms）+ 智能自动滚动（仅在距底 <80px 时跟随）

那份文档的「四、硬性约束」对本文档**全部四步同样适用**，特别是：
写任何 Next.js 代码前先读 `node_modules/next/dist/docs/`（`packages/web/AGENTS.md` 的要求）；
不要改 `@hermes/shared`；不要动 `packages/server`（legacy 是红线回退路径）。

---

## 五、事件契约

**`error` 事件是死的，不要再用。** `main` 上的 `54ed078` 为规避 Socket.IO v4 客户端保留
事件，已把任务失败改发 `task:error`、圆桌失败改发 `roundtable:error`，两者现已写入
`@hermes/shared` 的 `ServerToClientEvents`。ChatView 目前同时监听新旧两个名字（兼容期），
**新代码一律用 `task:error` / `roundtable:error`**。

`mock-player.ts:271` 仍在发 `'error'`，第一步里一并改掉。

---

## 六、总验收

四步全部完成后，端到端跑一遍：

```bash
# 终端 1
pnpm --filter @hermes/hiclaw-bridge dev          # 8650

# 终端 2
NEXT_PUBLIC_BACKEND=hiclaw pnpm dev:web
```

1. 页面 header 显示 `hiclaw · :8650`，连接指示为已连接，收到 `bridge:echo` 系统提示
2. 输入「生成一份新能源行业战略分析周报」→ 出现任务卡片（4 个子任务 + `规则拆解` 徽章 +
   可展开 reasoning）→ 四个 agent 依次流式输出且无明显抖动 → Validator 四维评分卡 → 汇总输出
3. 连发两条 → 第二条立刻收到「已有任务在执行」的错误条，不是静默丢弃
4. 上滑到历史位置 → 新消息到达时视图不被强制拽到底部
5. 停掉桥 → 断连提示 + 输入禁用；重启桥 → 自动重连恢复
6. 切回 `NEXT_PUBLIC_BACKEND=legacy` + `pnpm dev:server` → 行为与改动前一致（回归）
7. 不配 `HICLAW_GATEWAY_KEY` 启动 orchestrator → 日志里有醒目的离线模式 warn
8. `pnpm --filter @hermes/web build` 通过；orchestrator 单测通过

---

## 七、交付

- 分支 `feat/hiclaw-e2e`，**四步分四个 commit**，提交信息说明改了哪条事件通路
- PR 描述里贴上「六、总验收」逐条的实际执行结果（截图或终端输出），
  不接受「代码看起来对」
- 第三步的单测必须在 PR 里能看到实际运行输出
