# Hermes AgentOS — A (前端) 任务清单 & Codex 指令

> 技术栈：Next.js 16 + React 19 + Tailwind CSS 4  
> UI 来源：21st.dev 组件  
> 架构参考：hermes-studio  
> 分支：`feat/frontend-main`

---

## 前置依赖安装

```bash
pnpm --filter @hermes/web add @reactflow/react reactflow          # DAG Canvas
pnpm --filter @hermes/web add framer-motion                       # 动效
pnpm --filter @hermes/web add @radix-ui/react-dialog @radix-ui/react-tooltip @radix-ui/react-tabs  # 基础 UI
pnpm --filter @hermes/web add lucide-react                        # 图标
pnpm --filter @hermes/web add react-markdown remark-gfm           # Markdown 渲染
pnpm --filter @hermes/web add recharts                            # Dashboard 图表
pnpm --filter @hermes/web add class-variance-authority clsx tailwind-merge  # cn() 工具
```

---

## 任务清单

### Phase 1: 基础框架搭建 (Day 1–2, 8/6–8/7)

#### A-01 Shell 布局 + 侧边栏导航 [高优先]

- 参考 hermes-studio 的 Shell 布局：可折叠侧边栏 + 路由切换
- 侧边栏：Logo + 导航图标列表 + 底部连接状态指示
- 支持折叠/展开，移动端自动收起
- 导航项：Dialogue / DAG Canvas / AI Roundtable / Dashboard
- 深色/浅色主题切换按钮
- **21st.dev**: `/community/components/s/sidebar` 选一个动效侧边栏
- **hermes-studio**: 参考 Shell 布局的折叠逻辑和导航结构

#### A-02 Socket.IO 连接管理 Hook [高优先]

- 封装 `useSocket()` Hook，管理连接生命周期
- 自动连接/断开/重连逻辑
- 连接状态提供给全局（Context）
- 类型安全：使用 `@hermes/shared` 的 ClientToServerEvents / ServerToClientEvents
- 侧边栏底部显示实时连接状态（绿点/红点 + 文字）
- **hermes-studio**: 参考 Socket.IO 客户端的 namespace 连接模式

#### A-03 shadcn/ui 基础组件集成 [中优先]

- 从 21st.dev 搬运并统一基础组件：
  - Button (多 variant)
  - Input / Textarea
  - Dialog / Tooltip / Tabs
  - Card / Badge
- 配置 `cn()` 工具函数 (clsx + tailwind-merge)
- **21st.dev**: 按 shadcn 标准复制，统一放 `src/components/ui/`

---

### Phase 2: 核心视图开发 (Day 3–6, 8/8–8/11)

#### A-04 Chat 对话视图（流式输出）[高优先]

- 接入 B 的后端，实现完整对话流程
- 发送 `task:create` 事件
- 接收 `task:plan` → 展示 Agent 任务分配卡片
- 接收 `agent:stream` → 逐字流式渲染
- 接收 `agent:output` → 最终结果 Markdown 渲染
- 接收 `agent:status` → Agent 状态指示（running 动画 / success / failed）
- 接收 `agent:error` → 错误信息展示
- 消息气泡：用户靠右蓝色，Agent 靠左带角色标签和模型徽章
- **21st.dev**: `/community/components/s/ai-chat` 选一个 AI 聊天组件作为基础
- **hermes-studio**: 参考 ChatView 的流式渲染、tool-call 展开、Markdown 渲染逻辑

#### A-05 DAG Canvas 任务编排视图 [高优先]

- 用 React Flow 实现任务 DAG 可视化和实时状态更新
- 自定义 AgentNode 组件：图标 + 角色名 + 状态指示 + 进度条
- 自定义 Edge：带箭头的依赖连线
- 接收 `task:plan` 后自动布局生成 DAG 图
- 接收 `agent:status` 后实时更新节点颜色/动画
- 节点状态色：pending=灰, running=蓝+脉冲, success=绿, failed=红, rollback=橙
- 支持缩放/平移/自适应
- **hermes-studio**: 参考 WorkflowView 的 Vue Flow 节点设计：4 方向 handle、resizer、状态 dot 动画

#### A-06 AI Roundtable 圆桌会议视图 [高优先]

- 核心创新功能 — 多 Agent 圆桌讨论 UI
- 顶部：议题输入 + Agent 选择器（多选）+ 轮次设置 + 开始按钮
- 主区域：时间线式对话流，每个发言卡片包含：
  - Agent 头像/角色名 + 模型徽章
  - 发言轮次标记 (Round 1/2/3)
  - 立场标签（propose / challenge / supplement / synthesize）
  - 发言内容（Markdown 渲染）
- 底部：共识结果卡片 — 最终方案 + 执行任务列表 + 风险项
- Validator 校验状态：4 维评分 (accuracy / completeness / safety / format)
- **21st.dev**: `/community/components/s/ai-chat` 选多角色对话样式；`/community/components/s/card` 选共识结果卡片
- **hermes-studio**: 参考 GroupChatView 的多 Agent 消息路由和 @mention 机制

#### A-07 Dashboard 监控面板 [中优先]

- 系统运行状态总览面板
- 顶部 KPI 卡片行：总 Token 数 / 总花费 / 活跃任务 / 成功率
- Token 消耗折线图（按 Agent 分色）
- Cost 分布饼图（按模型分类）
- Roundtable 历史记录列表
- Experience Memory 成功率表格
- 数据源：轮询 B 的 `/api/stats/*` 接口
- **21st.dev**: `/community/components/s/dashboard` + `/community/components/s/data-visualization`
- **hermes-studio**: 参考 UsageView 的 Token/Cost 图表设计

---

### Phase 3: 治理层 UI + 视觉增强 (Day 7–9, 8/12–8/14)

#### A-08 Rollback 回滚可视化 [中优先]

- 在 DAG Canvas 和 Chat 中展示回滚过程
- 监听 `rollback:start` → 节点变橙 + "正在恢复" 动画
- 监听 `rollback:complete` → 显示恢复策略和结果
- 监听 `rollback:human` → 弹出人工干预对话框
- 恢复策略图标：snapshot_restore / model_switch / rerun / human_escalation

#### A-09 Trace 执行追踪面板 [中优先]

- 在 DAG Canvas 侧栏展示 Agent 执行 Trace
- 点击节点打开 Trace 侧面板
- 时间线展示各 Phase (START → CONTEXT_BUILD → MODEL_SELECTED → LLM_CALL → OUTPUT_VALIDATE → SUCCESS/FAIL)
- 每个 Phase 显示耗时、Token 数、成本
- Snapshot 快照对比视图

#### A-10 动效与视觉打磨 [低优先]

- 用 framer-motion + 21st.dev 动效组件提升视觉品质
- 页面切换过渡动画
- 节点状态切换动画（idle → running 脉冲 → success 绿光）
- Roundtable 发言卡片入场动效
- 流式文字打字机效果
- Dashboard 数据加载骨架屏
- Hero 背景：考虑 21st.dev 的 shader/gradient 效果
- **21st.dev**: `/community/shaders` + `/community/gradients` 选背景效果

---

## 目标文件结构

```
packages/web/src/
├── app/
│   ├── layout.tsx              # Shell 布局
│   └── page.tsx                # 主页路由
├── components/
│   ├── ui/                     # shadcn 基础组件 (Button, Card, Dialog...)
│   ├── shell/
│   │   ├── Sidebar.tsx         # A-01 侧边栏
│   │   └── ThemeToggle.tsx     # 主题切换
│   ├── chat/
│   │   ├── ChatView.tsx        # A-04 对话视图
│   │   ├── MessageBubble.tsx   # 消息气泡
│   │   ├── AgentStatusBar.tsx  # Agent 状态指示
│   │   └── StreamRenderer.tsx  # 流式渲染
│   ├── canvas/
│   │   ├── DAGCanvas.tsx       # A-05 DAG 画布
│   │   ├── AgentNode.tsx       # 自定义 Agent 节点
│   │   ├── StatusEdge.tsx      # 自定义依赖边
│   │   └── TracePanel.tsx      # A-09 Trace 侧栏
│   ├── roundtable/
│   │   ├── RoundtableView.tsx  # A-06 圆桌视图
│   │   ├── SpeechCard.tsx      # 发言卡片
│   │   ├── ConsensusCard.tsx   # 共识结果卡
│   │   └── TopicInput.tsx      # 议题输入
│   └── dashboard/
│       ├── DashboardView.tsx   # A-07 监控面板
│       ├── KPICards.tsx        # KPI 指标卡
│       ├── TokenChart.tsx      # Token 图表
│       └── CostChart.tsx       # 成本图表
├── hooks/
│   ├── useSocket.ts            # A-02 Socket 管理
│   ├── useRoundtable.ts        # 圆桌状态管理
│   └── useStats.ts             # Dashboard 数据
└── lib/
    ├── socket.ts               # Socket 实例（已有）
    └── cn.ts                   # className 工具
```

---

## Socket.IO 事件 → UI 映射表

| 事件 | 触发 UI | 涉及任务 |
|------|---------|----------|
| `task:plan` | Chat 展示任务卡片 + DAG 生成节点图 | A-04, A-05 |
| `agent:status` | DAG 节点颜色/动画更新 | A-05 |
| `agent:stream` | Chat 流式文字渲染 | A-04 |
| `agent:output` | Chat 最终结果 Markdown 展示 | A-04 |
| `agent:trace` | Trace 侧栏时间线 | A-09 |
| `agent:snapshot` | Trace 快照数据 | A-09 |
| `agent:error` | Chat 错误消息 + DAG 节点变红 | A-04, A-05 |
| `validator:result` | Roundtable 4 维评分显示 | A-06 |
| `rollback:start` | DAG 节点变橙 + 恢复中动画 | A-08 |
| `rollback:complete` | 恢复结果通知 | A-08 |
| `rollback:human` | 弹出人工干预对话框 | A-08 |
| `memory:updated` | Dashboard 经验记录更新 | A-07 |
| `roundtable:speech` | Roundtable 新增发言卡片 | A-06 |
| `roundtable:consensus` | Roundtable 展示共识结果 | A-06 |
| `error` | 全局错误 toast 通知 | 全局 |

---

## Codex 运行指令

### A-01 Shell 布局 + 侧边栏

```
在 packages/web/src/ 下创建前端 Shell 布局。

技术栈：Next.js 16 App Router + React 19 + Tailwind CSS 4。
类型定义在 packages/shared/src/types.ts 和 events.ts。

任务：
1. 创建 src/lib/cn.ts，导出 cn() 工具函数（clsx + tailwind-merge）
2. 创建 src/components/shell/Sidebar.tsx：
   - 可折叠侧边栏（默认展开，点击 logo 区域的按钮折叠）
   - 导航项：Dialogue (💬), DAG Canvas (🔀), AI Roundtable (🪑), Dashboard (📊)
   - 当前激活项高亮（蓝色背景 + 白色文字）
   - 底部显示 Socket 连接状态（绿点=连接，红点=断开）
   - 支持 dark mode（Tailwind dark: 前缀）
   - 折叠时只显示图标，展开时显示图标+文字
   - 使用 framer-motion 做折叠/展开过渡动画
3. 创建 src/components/shell/ThemeToggle.tsx：切换 dark/light 主题
4. 修改 src/app/layout.tsx 使用 Shell 布局包裹
5. 修改 src/app/page.tsx 使用 Sidebar 导航切换视图

侧边栏接收 props: { currentView, onViewChange, isConnected }
视图类型：type ViewMode = 'chat' | 'canvas' | 'roundtable' | 'dashboard'
```

### A-02 Socket.IO Hook

```
在 packages/web/src/hooks/ 下创建 Socket.IO 连接管理 Hook。

技术栈：React 19 + socket.io-client + @hermes/shared 类型。
现有 Socket 实例在 src/lib/socket.ts。
B 已定义的事件类型在 packages/shared/src/events.ts。

任务：
1. 创建 src/hooks/useSocket.ts：
   - 管理 socket 连接/断开/重连生命周期
   - 导出 { socket, isConnected, emit, on, off }
   - 使用 useEffect 自动连接和清理
   - 连接状态用 useState 跟踪
   - emit 函数类型安全（基于 ClientToServerEvents）
   - on/off 函数类型安全（基于 ServerToClientEvents）
2. 创建 src/hooks/useRoundtable.ts：
   - 管理圆桌会议状态
   - speeches: RoundtableSpeech[] — 所有发言
   - consensus: RoundtableConsensus | null — 最终共识
   - isRunning: boolean
   - start(config: RoundtableConfig): void — 发送 roundtable:start
   - 自动监听 roundtable:speech 和 roundtable:consensus 事件
3. 创建 src/hooks/useStats.ts：
   - 轮询 /api/stats/tokens, /api/stats/cost, /api/stats/health, /api/stats/roundtable
   - 返回 { tokens, cost, health, roundtable, isLoading }
   - 轮询间隔 5 秒，组件卸载时清理
```

### A-04 Chat 对话视图

```
在 packages/web/src/components/chat/ 下创建完整对话视图。

技术栈：React 19 + Tailwind CSS + framer-motion + react-markdown + remark-gfm。
使用 hooks/useSocket.ts 的 emit 和 on 函数。
Socket 事件类型在 packages/shared/src/events.ts。

任务：
1. 创建 src/components/chat/ChatView.tsx：
   - 顶部标题栏："Dialogue Center"
   - 中间消息列表（自动滚动到底部）
   - 底部输入框 + 发送按钮
   - 发送时调用 emit('task:create', { message })
   - 监听 agent:stream 事件做逐字流式渲染
   - 监听 agent:output 事件显示最终结果
   - 监听 task:plan 事件显示任务分配卡片
   - 监听 agent:error 事件显示错误消息
   - 空状态显示欢迎信息

2. 创建 src/components/chat/MessageBubble.tsx：
   - 用户消息：靠右，蓝色圆角气泡
   - Agent 消息：靠左，灰色背景，顶部显示 Agent 角色名 + 模型徽章
   - 内容用 react-markdown + remark-gfm 渲染
   - 流式消息有光标闪烁动画

3. 创建 src/components/chat/AgentStatusBar.tsx：
   - 横向展示当前任务中各 Agent 状态
   - 每个 Agent 一个小卡片：角色图标 + 状态 dot (running=蓝色脉冲, success=绿, failed=红)
   - 进度百分比

消息类型定义：
type ChatMessage =
  | { type: 'user'; content: string }
  | { type: 'plan'; tasks: SubTask[] }
  | { type: 'stream'; taskId: string; agent: string; chunks: string[] }
  | { type: 'output'; data: AgentOutput }
  | { type: 'error'; message: string }
```

### A-05 DAG Canvas

```
在 packages/web/src/components/canvas/ 下创建 DAG 任务编排视图。

技术栈：React 19 + reactflow + Tailwind CSS + framer-motion。
使用 hooks/useSocket.ts 监听事件。
类型在 packages/shared/src/types.ts (SubTask, AgentStatus, TaskStatus)。

任务：
1. 创建 src/components/canvas/AgentNode.tsx（React Flow 自定义节点）：
   - 圆角卡片样式，宽 200px
   - 顶部：Agent 角色图标 + 角色名
   - 中间：任务标题
   - 底部：状态指示 + 进度条
   - 状态颜色映射：pending=#94a3b8, running=#3b82f6, success=#22c55e, failed=#ef4444, rollback=#f59e0b
   - running 状态有 box-shadow 脉冲动画
   - 左侧和右侧各一个 Handle

2. 创建 src/components/canvas/StatusEdge.tsx（自定义边）：
   - 带箭头的贝塞尔曲线
   - 颜色随下游节点状态变化

3. 创建 src/components/canvas/DAGCanvas.tsx：
   - 接收 SubTask[] 数组，自动计算布局生成 nodes 和 edges
   - 使用 dagre 或手动分层布局算法
   - 实时监听 agent:status 更新节点状态
   - 支持缩放、平移、fit-to-view
   - 工具栏：放大、缩小、适应窗口、截图
   - 空状态："等待任务创建..."

布局算法：
- 按 dependsOn 关系分层（无依赖的在左，依赖多的在右）
- 同层节点垂直排列，层间水平间距 250px，节点间垂直间距 100px
```

### A-06 AI Roundtable 视图

```
在 packages/web/src/components/roundtable/ 下创建 AI 圆桌会议视图。

技术栈：React 19 + Tailwind CSS + framer-motion + react-markdown。
使用 hooks/useRoundtable.ts 管理状态。
类型：RoundtableConfig, RoundtableSpeech, RoundtableConsensus (from @hermes/shared)。

任务：
1. 创建 src/components/roundtable/TopicInput.tsx：
   - 议题输入框（大号 textarea）
   - Agent 多选器：data, research, analyst, writer（Checkbox 组）
   - 最大轮次选择：1/2/3（下拉或 radio）
   - "开始圆桌" 按钮（运行中禁用，显示 loading spinner）

2. 创建 src/components/roundtable/SpeechCard.tsx：
   - 左侧：Agent 头像圆圈（角色首字母 + 角色主题色）
   - 右侧上：Agent 名称 + 模型徽章 + Round 标记 + 立场标签
   - 立场标签颜色：propose=蓝, challenge=红, supplement=绿, moderate=紫, synthesize=金
   - 右侧下：Markdown 渲染的发言内容
   - 入场动画：从左滑入 + 淡入（framer-motion）

3. 创建 src/components/roundtable/ConsensusCard.tsx：
   - 金色边框的特殊卡片
   - 标题："共识达成"
   - 最终方案（Markdown 渲染）
   - 执行任务列表（表格：Agent / 目标 / 输入 / 预期输出）
   - 风险项列表（带警告图标）
   - Validator 评分展示：4 个维度的进度条

4. 创建 src/components/roundtable/RoundtableView.tsx：
   - 顶部：TopicInput（会议未开始时显示）
   - 主区域：SpeechCard 列表（时间线布局，左侧有轮次分隔线）
   - 底部：ConsensusCard（会议结束后显示）
   - 会议进行中顶部显示当前轮次进度
```

### A-07 Dashboard 监控面板

```
在 packages/web/src/components/dashboard/ 下创建系统监控面板。

技术栈：React 19 + Tailwind CSS + recharts。
使用 hooks/useStats.ts 获取数据。
B 的 API 端点：GET /api/stats/tokens, /api/stats/cost, /api/stats/health, /api/stats/roundtable。

任务：
1. 创建 src/components/dashboard/KPICards.tsx：
   - 4 个指标卡片横排（grid 2x2 或 flex 4 列）
   - 总 Token 数（数字 + "tokens" 标签）
   - 总花费（$xx.xx 格式）
   - 活跃任务数
   - 系统状态（ok=绿色勾, 异常=红色叉）
   - 每个卡片有小图标和浅色背景

2. 创建 src/components/dashboard/TokenChart.tsx：
   - recharts AreaChart
   - X 轴：时间，Y 轴：Token 数
   - 按 Agent 分色显示（data=蓝, research=绿, analyst=紫, writer=橙）

3. 创建 src/components/dashboard/CostChart.tsx：
   - recharts PieChart
   - 按模型分类显示成本占比
   - 中心显示总成本数字

4. 创建 src/components/dashboard/DashboardView.tsx：
   - 顶部：KPICards
   - 中间左：TokenChart，中间右：CostChart（grid 2 列）
   - 底部：Roundtable 历史列表 + Experience Memory 表格
   - 数据 5 秒自动刷新，加载中显示骨架屏
```

---

## 注意事项

- 所有任务基于 `feat/frontend-main` 分支开发
- 运行前先确保 `pnpm install` 已执行且 `@hermes/shared` 类型可用
- 每个任务独立提交，commit 格式：`feat(web): A-0X 任务描述`
- B 的后端代码在 `feat/backend-main` 分支，联调前需先合并到 main
