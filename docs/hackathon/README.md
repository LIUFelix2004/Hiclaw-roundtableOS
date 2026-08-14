# 黑客松路演 PPT

Hermes AgentOS 的参赛路演稿，共 16 页，深色线条视觉体系（细发丝线 + 网格底图 + 等宽索引标签）。

## 文件

| 文件 | 说明 |
|------|------|
| `Hermes-AgentOS-Hackathon.pptx` | 主交付物，可直接在 PowerPoint / WPS 打开编辑 |
| `Hermes-AgentOS-Hackathon.pdf` | 放映备份，用于现场无 Office 或字体缺失的情况 |
| `deck-src/build.js` | 幻灯片生成脚本（pptxgenjs） |
| `deck-src/assets.js` | 背景底图生成脚本（sharp，输出三张 PNG） |
| `deck-src/bg-*.png` | 已生成的封面 / 内页 / 分隔页底图 |

## 页面结构

| 页 | 内容 |
|----|------|
| 01 | 封面 —— 定位与关键数字 |
| 02 | 痛点：多智能体离生产还差三道坎 |
| 03 | 解决方案：执行 / 治理 / 协作 / 观测 四层架构 |
| 04 | 系统架构：Client → BFF → AgentOS Server + 7 个 Agent |
| 05 | 亮点 01 声明式 Skill 架构 |
| 06 | 亮点 02 DAG 拓扑分层并行调度 |
| 07 | 亮点 03 Validator 输出防火墙 |
| 08 | 亮点 04 Rollback 四级自愈阶梯 |
| 09 | 亮点 05 Experience Memory 经验记忆 |
| 10 | 亮点 06 AI 圆桌与 3D 像素可视化 |
| 11 | 亮点 07 全链路 Trace 可观测 |
| 12 | 端到端自愈闭环叙事 |
| 13 | 演示场景：新能源行业战略分析周报 |
| 14 | 技术栈与工程质量 |
| 15 | 与通用编排框架的差异化对比 |
| 16 | 路线图与致谢 |

每页都写了演讲备注（PowerPoint 备注栏），包含讲解重点和评委常见追问的应对。

## 重新生成

```bash
cd docs/hackathon/deck-src
npm install pptxgenjs sharp
node assets.js      # 生成三张背景底图（已提交，通常无需重跑）
node build.js       # 输出 Hermes-AgentOS-Hackathon.pptx 到当前目录
```

## 字体说明

正文使用 **Microsoft YaHei**（微软雅黑），英文与数字使用 **Arial**，等宽标签使用 **Courier New**。
在 macOS 上打开如果字重异常，把正文字体整体替换为苹方或思源黑体即可，版式不受影响。

## 数据口径

第 13 页的新能源数字全部取自仓库内置的演示数据集
（`packages/server/src/demo/new-energy.ts`），属于模拟数据，答辩时请如实说明。
其余页面的能力描述均对应仓库中已实现的代码路径。
