# 黑客松路演 PPT

Hermes AgentOS 参赛路演稿，共 16 页，**以 AI 圆桌为主线**重构叙事。

用 [PPT Master](https://github.com/hugohe3/ppt-master) 的 SVG → 原生 DrawingML 管线生成：
每一页先按语义 SVG 设计，再编译成 PowerPoint 原生形状。文字、圆桌插画、连线、
渐变全部是可点选可编辑的矢量对象，不是截图，整份文件只有 110 KB。

## 文件

| 文件 | 说明 |
|------|------|
| `Hermes-AgentOS-Roundtable.pptx` | 主交付物，16 页均带演讲备注，可在 PowerPoint / WPS 直接编辑 |
| `Hermes-AgentOS-Roundtable.pdf` | 放映备份，用于现场无 Office 或字体缺失的情况 |
| `deck-src/gen.py` | 幻灯片生成器，输出 16 份语义 SVG |
| `deck-src/svg_output/` | 生成好的 16 页 SVG，可直接改后重新编译 |
| `deck-src/notes/` | 逐页演讲备注（`total.md` 为合并版） |
| `deck-src/spec_lock.md` | 设计锁：画布、配色、字阶、页面节奏 |

## 叙事结构

圆桌是主角，占 7 页（03–09）；底座能力压缩到 3 页，作为"圆桌为什么敢用"的支撑。

| 页 | 内容 |
|----|------|
| 01 | 封面 —— 让 AI 开一场圆桌会议 |
| 02 | 痛点：一个 Agent 的答案，没人敢直接用 |
| 03 | **核心主张：AI 圆桌，让分歧先发生在系统内部** |
| 04 | **圆桌机制：目标确认 → 多轮发言 → 共识合成 → 出口质检** |
| 05 | **七个席位与五种立场标签** |
| 06 | **三轮辩论：从各说各话到互相咬合** |
| 07 | **收敛：共识 / 分歧 / 执行任务 / 风险项 四段式交付** |
| 08 | **出口防火墙：共识也要过闸** |
| 09 | **3D 实时舞台：看得见的圆桌** |
| 10 | 支撑体系总览（执行 / 治理 / 协作 / 观测） |
| 11 | 底座 01 声明式 Skill + DAG 调度 |
| 12 | 底座 02 四级自愈 + 经验记忆 |
| 13 | 底座 03 全链路 Trace |
| 14 | 演示场景：新能源主线之争 |
| 15 | 与常见多智能体方案的差异 |
| 16 | 路线图与致谢 |

## 设计体系

- **底色**：`#050A18` 深空场 + 极光径向渐变，玻璃面板配 1px 发丝描边与顶边高光
- **主视觉母题**：椭圆圆桌 + 七个席位节点 + 轨道环，在封面、主张页、3D 页、尾页反复出现
- **智能体配色**直接取自产品实时界面（`PixelRoundtable3D.vue`），保证 PPT 与实机演示视觉一致
- **字阶**收敛为 15 个具名角色，全部在 `spec_lock.md` 声明，不允许出现未声明字号

## 重新生成

```bash
git clone https://github.com/hugohe3/ppt-master /tmp/ppt-master
pip install python-pptx XlsxWriter skia-pathops uharfbuzz

cd docs/hackathon/deck-src
python3 gen.py                       # 输出 svg_output/*.svg

# 质量门禁（必须 blocking: 0 才能导出）
python3 /tmp/ppt-master/skills/ppt-master/scripts/svg_quality_checker.py . --stage final --json

# 编译为原生 PPTX
python3 /tmp/ppt-master/skills/ppt-master/scripts/svg_to_pptx.py . \
  -o ../Hermes-AgentOS-Roundtable.pptx -f ppt169 --with-notes
```

改文案只需要动 `gen.py` 里对应页的函数，版式会自动重排（内置按字宽的中英混排换行）。

## 字体说明

正文 **Microsoft YaHei**，英文与数字 **Arial**，等宽标签 **Consolas / Courier New**。
macOS 上若字重异常，把正文整体替换为苹方或思源黑体即可，版式不受影响。

## 数据口径

第 14 页的新能源数字取自仓库内置演示数据集（`packages/server/src/demo/new-energy.ts`），
属于模拟数据，答辩时请如实说明。其余页面的能力描述均对应仓库中已实现的代码路径。
