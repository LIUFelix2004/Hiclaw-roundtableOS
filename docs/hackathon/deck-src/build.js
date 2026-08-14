/**
 * Hermes AgentOS — Hackathon pitch deck.
 * Dark, hairline-driven visual system: thin rules, wire grids, mono index labels.
 */
const pptxgen = require('pptxgenjs');

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5
pres.author = 'Hermes AgentOS Team';
pres.title = 'Hermes AgentOS — 生产级多智能体操作系统';

const W = 13.333, H = 7.5, M = 0.62;
const CW = W - M * 2;

const C = {
  panel: '0C1526',
  line: '1E3055',
  lineHi: '3A63A8',
  text: 'EAF0FA',
  dim: '9AACCB',
  mute: '64799E',
  blue: '4B87FF',
  cyan: '2FD8E6',
  green: '2BD9A0',
  amber: 'F5A524',
  red: 'FF6B87',
  violet: 'A78BFA',
  white: 'FFFFFF',
};
const F = { cn: 'Microsoft YaHei', en: 'Arial', mono: 'Courier New' };

const BG_COVER = { path: 'bg-cover.png' };
const BG_CONTENT = { path: 'bg-content.png' };
const BG_SECTION = { path: 'bg-section.png' };

let pageNo = 0;

/* ── primitives ─────────────────────────────────────────── */

function newSlide(bg) {
  const s = pres.addSlide();
  s.background = { path: bg.path };
  return s;
}

// Hairline-bordered panel — the deck's single repeated motif.
function panel(s, x, y, w, h, o = {}) {
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: 0.05,
    fill: { color: o.fill || C.panel, transparency: o.transparency == null ? 26 : o.transparency },
    line: { color: o.line || C.line, width: o.lineWidth || 0.75 },
  });
}

function hairline(s, x, y, w, color = C.line, width = 0.75) {
  s.addShape(pres.ShapeType.line, { x, y, w, h: 0, line: { color, width } });
}

function vline(s, x, y, h, color = C.line, width = 0.75) {
  s.addShape(pres.ShapeType.line, { x, y, w: 0, h, line: { color, width } });
}

function mono(s, text, x, y, w, o = {}) {
  s.addText(text, {
    x, y, w, h: o.h || 0.26,
    fontFace: F.mono, fontSize: o.fontSize || 9.5, bold: o.bold || false,
    color: o.color || C.mute, charSpacing: o.charSpacing == null ? 1.6 : o.charSpacing,
    align: o.align || 'left', valign: 'middle', margin: 0,
  });
}

function txt(s, text, x, y, w, h, o = {}) {
  s.addText(text, {
    x, y, w, h,
    fontFace: o.fontFace || F.cn, fontSize: o.fontSize || 13, bold: o.bold || false,
    color: o.color || C.dim, align: o.align || 'left', valign: o.valign || 'top',
    lineSpacingMultiple: o.lineSpacingMultiple || 1.3, margin: 0,
    charSpacing: o.charSpacing || 0, italic: o.italic || false,
  });
}

// Slide header: mono eyebrow + title (+ optional standfirst).
function header(s, eyebrow, title, sub) {
  mono(s, eyebrow, M, 0.52, CW * 0.7, { color: C.blue, fontSize: 10, bold: true, charSpacing: 2.2 });
  txt(s, title, M, 0.86, CW * 0.78, 0.62, {
    fontSize: 30, bold: true, color: C.white, lineSpacingMultiple: 1.0,
  });
  if (sub) txt(s, sub, M, 1.53, CW * 0.78, 0.34, { fontSize: 12.5, color: C.mute });
}

function footer(s, label) {
  pageNo += 1;
  hairline(s, M, H - 0.62, CW, C.line, 0.75);
  mono(s, 'HERMES  AGENTOS', M, H - 0.52, 3.2, { fontSize: 8.5, color: C.mute });
  mono(s, label, M + 3.4, H - 0.52, CW - 4.2, { fontSize: 8.5, color: C.mute });
  mono(s, String(pageNo).padStart(2, '0'), W - M - 0.6, H - 0.52, 0.6, {
    fontSize: 9.5, color: C.lineHi, align: 'right', bold: true,
  });
}

// Small hairline circle carrying an index or glyph.
function bullet(s, label, x, y, d, color) {
  s.addShape(pres.ShapeType.ellipse, {
    x, y, w: d, h: d,
    fill: { color: '000000', transparency: 100 },
    line: { color, width: 1 },
  });
  s.addText(label, {
    x, y, w: d, h: d,
    fontFace: F.mono, fontSize: 10, bold: true, color, align: 'center', valign: 'middle', margin: 0,
  });
}

// Pill chip with hairline border.
function chip(s, label, x, y, w, h, color) {
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: h / 2,
    fill: { color: '0B1424', transparency: 20 },
    line: { color: color || C.line, width: 0.75 },
  });
  s.addText(label, {
    x, y, w, h,
    fontFace: F.cn, fontSize: 10.5, color: color || C.dim,
    align: 'center', valign: 'middle', margin: 0,
  });
}

function arrow(s, x, y, w, color = C.lineHi) {
  s.addShape(pres.ShapeType.line, {
    x, y, w, h: 0,
    line: { color, width: 0.9, endArrowType: 'triangle' },
  });
}

/* ═══ 01 · COVER ════════════════════════════════════════ */
{
  const s = newSlide(BG_COVER);
  mono(s, 'HACKATHON  2026    ·    MULTI-AGENT  INFRASTRUCTURE', M, 0.66, 8, {
    fontSize: 10, color: C.blue, bold: true, charSpacing: 2.4,
  });
  hairline(s, M, 1.05, 4.9, C.lineHi, 1);

  s.addText('Hermes AgentOS', {
    x: M, y: 1.35, w: 8.4, h: 1.05,
    fontFace: F.en, fontSize: 54, bold: true, color: C.white, margin: 0, valign: 'middle',
  });
  s.addText('生产级多智能体操作系统', {
    x: M, y: 2.45, w: 8.4, h: 0.62,
    fontFace: F.cn, fontSize: 27, color: C.blue, margin: 0, valign: 'middle', charSpacing: 1.5,
  });

  txt(s, '不只是把多个 Agent 串起来，而是给它们一套可校验、可自愈、可观测的运行时。\n让多智能体协作从「跑得通的 Demo」变成「敢上生产的系统」。', M, 3.28, 7.3, 0.95, {
    fontSize: 14, color: C.dim, lineSpacingMultiple: 1.5,
  });

  hairline(s, M, 4.62, 7.3, C.line, 0.75);

  const chips = ['Skill 化架构', 'DAG 并行调度', '输出防火墙', '四级自愈回滚', '经验记忆', 'AI 圆桌'];
  const cw = 1.16, gap = 0.075;
  chips.forEach((label, i) => {
    chip(s, label, M + i * (cw + gap), 4.86, cw, 0.4, i === 0 ? C.blue : C.line);
  });

  // Hairline stat rail
  const stats = [['7', 'Skill Agents'], ['18', '事件契约'], ['4', '级自愈策略'], ['8', '阶段 Trace']];
  stats.forEach(([n, l], i) => {
    const x = M + i * 1.85;
    s.addText(n, {
      x, y: 5.6, w: 1.6, h: 0.5,
      fontFace: F.en, fontSize: 30, bold: true, color: C.white, margin: 0, valign: 'middle',
    });
    txt(s, l, x, 6.12, 1.7, 0.24, { fontSize: 10.5, color: C.mute });
  });

  hairline(s, M, H - 0.62, CW, C.line, 0.75);
  mono(s, 'liufelix2004 / hermes-agentos', M, H - 0.52, 5, { fontSize: 8.5, color: C.mute });
  mono(s, 'PITCH  DECK', W - M - 2.6, H - 0.52, 2.6, { fontSize: 8.5, color: C.mute, align: 'right' });
  pageNo = 1;
  s.addNotes('开场：我们做的不是又一个 Agent 编排 Demo，而是一套多智能体的操作系统。今天想讲清楚三件事：为什么现在的多智能体上不了生产、我们用什么架构解决、以及现场能跑给你看。');
}

/* ═══ 02 · THE GAP ══════════════════════════════════════ */
{
  const s = newSlide(BG_CONTENT);
  header(s, '01 / THE GAP', '多智能体离生产，还差三道坎', '模型能力已经够用，缺的是把它们「管起来」的工程底座');

  const items = [
    ['01', '输出不可信', C.red,
      'LLM 幻觉直接流入下游节点，错误逐级放大；最后一公里只能靠人肉复核，规模化无从谈起。'],
    ['02', '失败不可恢复', C.amber,
      '一次超时、限流或格式漂移就让整条链路崩溃，只能整体重跑，既贵又慢，没有恢复策略。'],
    ['03', '过程不可观测', C.violet,
      '黑盒执行：卡在哪一步、烧了多少 Token、成本花在哪都说不清，问题无法定位到阶段。'],
  ];
  const cw = (CW - 0.36 * 2) / 3;
  items.forEach(([idx, title, color, body], i) => {
    const x = M + i * (cw + 0.36);
    panel(s, x, 2.2, cw, 2.92);
    bullet(s, idx, x + 0.42, 2.56, 0.42, color);
    txt(s, title, x + 0.42, 3.2, cw - 0.84, 0.36, { fontSize: 18, bold: true, color: C.white });
    hairline(s, x + 0.42, 3.68, 0.7, color, 1);
    txt(s, body, x + 0.42, 3.9, cw - 0.84, 1.05, { fontSize: 11.5, color: C.dim, lineSpacingMultiple: 1.45 });
  });

  panel(s, M, 5.42, CW, 0.86, { fill: '0E1D38', transparency: 18, line: C.lineHi });
  txt(s, '缺的不是更聪明的 Agent，而是一套能治理它们的 OS —— 校验、自愈、观测，必须做进运行时。',
    M + 0.44, 5.66, CW - 0.88, 0.4, { fontSize: 15, bold: true, color: C.white });

  footer(s, '为什么需要一个 AgentOS');
  s.addNotes('这三道坎是我们做项目前踩过的真实问题。注意第三点：不可观测是前两点无法解决的根因——你连失败在哪都不知道，就谈不上自动恢复。');
}

/* ═══ 03 · SOLUTION OVERVIEW ════════════════════════════ */
{
  const s = newSlide(BG_CONTENT);
  header(s, '02 / THE ANSWER', 'Hermes AgentOS：把治理能力做进运行时', 'Agent 只负责「想」，可靠性由 OS 统一负责');

  const layers = [
    ['执行层', 'EXECUTION', C.blue, 'Planner 任务拆解 · DAG 并行调度器 · 7 个 Skill Agent'],
    ['治理层', 'GOVERNANCE', C.green, 'Validator 输出防火墙 · Rollback 四级自愈 · Experience Memory'],
    ['协作层', 'COLLABORATION', C.violet, 'Moderator 主持的 AI 圆桌 · 多轮辩论 · 共识合成与收敛'],
    ['观测层', 'OBSERVABILITY', C.cyan, 'Trace 8 阶段全链路 · Snapshot 快照 · Token / Cost 实时统计'],
  ];
  layers.forEach(([cn, en, color, body], i) => {
    const y = 2.15 + i * 0.99;
    panel(s, M, y, CW, 0.9);
    vline(s, M + 0.02, y + 0.14, 0.62, color, 2.2);
    txt(s, cn, M + 0.34, y + 0.16, 1.5, 0.32, { fontSize: 17, bold: true, color: C.white });
    mono(s, en, M + 0.34, y + 0.52, 2, { fontSize: 8.5, color: color });
    vline(s, M + 2.5, y + 0.18, 0.54, C.line, 0.75);
    txt(s, body, M + 2.82, y + 0.3, CW - 3.3, 0.34, { fontSize: 13.5, color: C.dim });
  });

  txt(s, '一句话：Skill 负责能力，Runtime 负责可靠性 —— 新增一个 Agent，不用碰任何调度、重试、观测代码。',
    M, 6.3, CW, 0.34, { fontSize: 12.5, color: C.mute, italic: true });

  footer(s, '四层架构总览');
  s.addNotes('这张是全局地图。后面每一页展开一个亮点，都能回到这张图上定位。');
}

/* ═══ 04 · ARCHITECTURE ═════════════════════════════════ */
{
  const s = newSlide(BG_CONTENT);
  header(s, '03 / ARCHITECTURE', '端到端类型安全的三段式架构', '前端 · BFF 桥接 · AgentOS 内核，全链路共享一份事件契约');

  const boxW = 3.5, boxY = 2.25, boxH = 1.75;
  const cols = [
    ['Vue 3 Client', 'DAG 画布 · 3D 圆桌\nDashboard · Trace 面板', C.blue],
    ['Studio BFF', 'Socket.IO 桥接\n事件翻译 · 会话存储', C.violet],
    ['AgentOS Server', 'Koa + Socket.IO :8648\nPlanner · Scheduler', C.cyan],
  ];
  const gapX = (CW - boxW * 3) / 2;
  cols.forEach(([title, body, color], i) => {
    const x = M + i * (boxW + gapX);
    panel(s, x, boxY, boxW, boxH);
    mono(s, ['CLIENT', 'BRIDGE', 'KERNEL'][i], x + 0.32, boxY + 0.24, 2, { fontSize: 8.5, color });
    txt(s, title, x + 0.32, boxY + 0.54, boxW - 0.64, 0.36, { fontSize: 18, bold: true, color: C.white });
    txt(s, body, x + 0.32, boxY + 1.0, boxW - 0.64, 0.6, { fontSize: 11.5, color: C.dim, lineSpacingMultiple: 1.35 });
    if (i < 2) arrow(s, x + boxW + 0.12, boxY + boxH / 2, gapX - 0.24);
  });

  mono(s, '@hermes/shared  ·  18 个类型安全事件契约', M, 4.16, CW, {
    fontSize: 9, color: C.mute, align: 'center', charSpacing: 1.8,
  });
  hairline(s, M, 4.46, CW, C.line, 0.75);

  const agents = [
    ['Data', '数据', C.blue], ['Research', '研究', C.blue], ['Analyst', '分析', C.amber],
    ['Writer', '撰写', C.green], ['Moderator', '主持', C.violet], ['Validator', '质检', C.red],
    ['Rollback', '回滚', C.cyan],
  ];
  const aw = (CW - 0.16 * 6) / 7;
  agents.forEach(([en, cn, color], i) => {
    const x = M + i * (aw + 0.16);
    panel(s, x, 4.72, aw, 0.98, { transparency: 34 });
    txt(s, cn, x, 4.9, aw, 0.28, { fontSize: 14, bold: true, color: C.white, align: 'center' });
    mono(s, en.toUpperCase(), x, 5.24, aw, { fontSize: 7.5, color, align: 'center', charSpacing: 0.8 });
  });

  txt(s, '所有 Agent 通过同一条事件总线上报状态：前端看到的每一次流式输出、每一个节点变色、每一笔 Token 消耗，都来自真实执行流，没有一处是前端伪造的动画。',
    M, 5.94, CW, 0.5, { fontSize: 12, color: C.mute, lineSpacingMultiple: 1.4 });

  footer(s, '系统架构');
  s.addNotes('强调最后一句：可视化不是演出效果，是真实事件驱动的。评委常问的「这是不是写死的动画」，这里先答掉。');
}

/* ═══ 05 · HIGHLIGHT 01 — SKILL ARCHITECTURE ════════════ */
{
  const s = newSlide(BG_CONTENT);
  header(s, '亮点 01 / SKILL ARCHITECTURE', '声明式 Skill：新增 Agent 不写调度代码', '每个 Agent 只声明「它会什么」，其余全部由 Runtime 托管');

  panel(s, M, 2.2, 5.9, 3.55);
  mono(s, 'packages/server/src/agents/analyst/', M + 0.36, 2.44, 5.2, { fontSize: 9, color: C.blue });
  hairline(s, M + 0.36, 2.78, 5.2, C.line, 0.75);
  const files = [
    ['skill.json', '能力声明 / 版本 / 复杂度'],
    ['prompt.ts', '结构化 Prompt 构建'],
    ['schema.ts', '输出数据结构定义'],
    ['validator.ts', '输出 Schema 校验'],
    ['tools.ts', '工具与数据源绑定'],
  ];
  files.forEach(([name, desc], i) => {
    const y = 2.96 + i * 0.53;
    mono(s, (i === files.length - 1 ? '└─ ' : '├─ ') + name, M + 0.36, y, 2.1, {
      fontSize: 10.5, color: C.text, charSpacing: 0,
    });
    txt(s, desc, M + 2.6, y + 0.02, 2.9, 0.26, { fontSize: 11, color: C.mute });
  });

  const rx = M + 6.3, rw = CW - 6.3;
  panel(s, rx, 2.2, rw, 3.55, { fill: '0E1D38', transparency: 22, line: C.lineHi });
  txt(s, 'Runtime 统一托管', rx + 0.4, 2.46, rw - 0.8, 0.34, { fontSize: 17, bold: true, color: C.white });
  hairline(s, rx + 0.4, 2.88, 0.7, C.blue, 1);
  const runtime = [
    ['Trace 生命周期', '8 个阶段自动埋点上报'],
    ['Snapshot 快照', '输入/输出双向落盘留痕'],
    ['重试与退避', '最多 5 次尝试，2s 递增退避'],
    ['错误分类', 'DATA / MODEL / TOOL / POLICY'],
    ['模型选择与回写', '按经验记忆选模型并回写成败'],
  ];
  runtime.forEach(([k, v], i) => {
    const y = 3.1 + i * 0.52;
    s.addShape(pres.ShapeType.ellipse, {
      x: rx + 0.42, y: y + 0.08, w: 0.09, h: 0.09,
      fill: { color: C.blue }, line: { color: C.blue, width: 0.5 },
    });
    txt(s, k, rx + 0.68, y, 1.9, 0.26, { fontSize: 12.5, bold: true, color: C.text });
    txt(s, v, rx + 2.62, y + 0.01, rw - 3.05, 0.26, { fontSize: 11.5, color: C.mute });
  });

  panel(s, M, 6.0, CW, 0.62, { transparency: 40 });
  txt(s, '接入一个新 Agent = 5 个声明式文件 + 0 行调度代码。能力可插拔，可靠性不重复建设。',
    M + 0.4, 6.14, CW - 0.8, 0.34, { fontSize: 13.5, bold: true, color: C.text });

  footer(s, '亮点 01 · Skill 化 Agent 架构');
  s.addNotes('这是可扩展性的核心论据。评委如果问「加一个新角色要多久」，答案就是这一页：写 5 个文件，调度/重试/观测全部白送。');
}

/* ═══ 06 · HIGHLIGHT 02 — DAG SCHEDULER ═════════════════ */
{
  const s = newSlide(BG_CONTENT);
  header(s, '亮点 02 / DAG SCHEDULER', '拓扑分层 + 同层并行的任务调度器', 'Planner 拆解依赖，Scheduler 用 Kahn 算法分层，能并行的绝不串行');

  // DAG diagram
  panel(s, M, 2.2, 7.2, 2.5);
  const nodes = [
    ['Data', '数据采集', 0.45, C.blue],
    ['Research', '行业调研', 2.35, C.blue],
    ['Analyst', '洞察分析', 4.25, C.amber],
    ['Writer', '成稿输出', 6.15, C.green],
  ];
  nodes.forEach(([en, cn, dx, color], i) => {
    const x = M + dx, y = 2.85;
    s.addShape(pres.ShapeType.roundRect, {
      x, y, w: 1.35, h: 1.0, rectRadius: 0.05,
      fill: { color: '0B1730', transparency: 10 },
      line: { color, width: 1 },
    });
    txt(s, cn, x, y + 0.2, 1.35, 0.28, { fontSize: 13.5, bold: true, color: C.white, align: 'center' });
    mono(s, en.toUpperCase(), x, y + 0.55, 1.35, { fontSize: 7.5, color, align: 'center' });
    if (i < 3) arrow(s, x + 1.35 + 0.08, y + 0.5, 0.39);
  });
  mono(s, 'LEVEL 1', M + 0.45, 2.5, 1.35, { fontSize: 7.5, color: C.mute, align: 'center' });
  mono(s, 'LEVEL 2', M + 2.35, 2.5, 1.35, { fontSize: 7.5, color: C.mute, align: 'center' });
  mono(s, 'LEVEL 3', M + 4.25, 2.5, 1.35, { fontSize: 7.5, color: C.mute, align: 'center' });
  mono(s, 'LEVEL 4', M + 6.15, 2.5, 1.35, { fontSize: 7.5, color: C.mute, align: 'center' });
  txt(s, '同层任务用 Promise.all 并行执行；上游输出自动注入下游上下文',
    M + 0.45, 4.12, 7.0, 0.28, { fontSize: 11, color: C.mute });

  const rx = M + 7.6, rw = CW - 7.6;
  const points = [
    ['Kahn 拓扑排序', '按依赖关系自动分层，无需手写编排顺序'],
    ['同层并行执行', '互不依赖的子任务同时开跑，压缩端到端耗时'],
    ['上下文自动注入', '上游产出裁剪后注入下游 Prompt，带角色标签'],
    ['死锁检测与安全阀', '环依赖立即上报，maxRounds 防止无限循环'],
  ];
  points.forEach(([k, v], i) => {
    const y = 2.2 + i * 1.12;
    panel(s, rx, y, rw, 0.98, { transparency: 34 });
    mono(s, '0' + (i + 1), rx + 0.28, y + 0.2, 0.4, { fontSize: 10, color: C.blue, bold: true });
    txt(s, k, rx + 0.75, y + 0.16, rw - 1.05, 0.28, { fontSize: 13.5, bold: true, color: C.white });
    txt(s, v, rx + 0.75, y + 0.52, rw - 1.05, 0.3, { fontSize: 11, color: C.mute });
  });

  panel(s, M, 4.92, 7.2, 1.5, { fill: '0E1D38', transparency: 22, line: C.lineHi });
  txt(s, '调度器不理解业务，只理解依赖', M + 0.4, 5.1, 6.4, 0.3, { fontSize: 15, bold: true, color: C.white });
  txt(s, 'Planner 输出的 DAG 是纯数据结构，Scheduler 只做「谁的依赖满足了就派谁上」。\n换业务场景不需要改调度代码 —— 换一份任务图就行。',
    M + 0.4, 5.5, 6.4, 0.7, { fontSize: 11.5, color: C.dim, lineSpacingMultiple: 1.45 });

  footer(s, '亮点 02 · DAG 并行调度');
  s.addNotes('可以现场指着 DAG 画布说：这四个节点的颜色变化是真实的调度状态，不是动画。');
}

/* ═══ 07 · HIGHLIGHT 03 — VALIDATOR FIREWALL ════════════ */
{
  const s = newSlide(BG_CONTENT);
  header(s, '亮点 03 / OUTPUT FIREWALL', 'Validator 输出防火墙：不合格就别想过去', '每一个 Agent 的产出都要过一道独立质检，四维打分，一票否决');

  const dims = [
    ['accuracy', '准确性', '事实与数据是否站得住', C.blue],
    ['completeness', '完整性', '任务要求是否全部覆盖', C.cyan],
    ['safety', '安全性', '是否越界或含有害内容', C.red],
    ['format', '格式', '是否符合下游 Schema', C.green],
  ];
  const dw = (CW - 0.3 * 3) / 4;
  dims.forEach(([en, cn, desc, color], i) => {
    const x = M + i * (dw + 0.3);
    panel(s, x, 2.18, dw, 1.72);
    mono(s, en.toUpperCase(), x + 0.3, 2.42, dw - 0.6, { fontSize: 8.5, color });
    txt(s, cn, x + 0.3, 2.74, dw - 0.6, 0.36, { fontSize: 19, bold: true, color: C.white });
    hairline(s, x + 0.3, 3.2, 0.6, color, 1);
    txt(s, desc, x + 0.3, 3.36, dw - 0.6, 0.34, { fontSize: 11, color: C.mute });
  });

  // firewall flow
  panel(s, M, 4.1, CW, 1.42, { transparency: 34 });
  const chain = [['Agent 输出', 1.7], ['Validator 四维打分', 2.5]];
  let fx = M + 0.42;
  chain.forEach(([label, w], i) => {
    s.addShape(pres.ShapeType.roundRect, {
      x: fx, y: 4.56, w, h: 0.5, rectRadius: 0.25,
      fill: { color: '0B1730', transparency: 14 },
      line: { color: C.line, width: 0.75 },
    });
    txt(s, label, fx, 4.56, w, 0.5, {
      fontSize: 11.5, color: i === 1 ? C.white : C.dim, align: 'center', valign: 'middle',
    });
    arrow(s, fx + w + 0.1, 4.81, 0.36);
    fx += w + 0.56;
  });

  const branches = [
    ['pass = true   →   输出放行，流向下游节点', C.green, 4.3],
    ['pass = false  →   failCodes 直接驱动 Rollback 自愈', C.red, 4.92],
  ];
  branches.forEach(([label, color, y]) => {
    s.addShape(pres.ShapeType.roundRect, {
      x: M + 5.6, y, w: 5.9, h: 0.44, rectRadius: 0.22,
      fill: { color: '0B1730', transparency: 14 }, line: { color, width: 0.75 },
    });
    txt(s, label, M + 5.6, y, 5.9, 0.44, { fontSize: 11.5, color, align: 'center', valign: 'middle' });
  });
  s.addShape(pres.ShapeType.line, {
    x: M + 5.2, y: 4.52, w: 0, h: 0.62, line: { color: C.line, width: 0.75 },
  });
  arrow(s, M + 5.2, 4.52, 0.36, C.green);
  arrow(s, M + 5.2, 5.14, 0.36, C.red);

  const notes = [
    ['failCodes 对齐错误分类', '校验失败码与 DATA / MODEL / TOOL / POLICY 一一对应，恢复策略可直接消费'],
    ['最多 5 轮拦截—修复循环', '每次拦截都会触发一次恢复尝试，反复不过才升级为人工工单'],
    ['圆桌共识同样受管', '多智能体讨论出的最终方案，也必须通过防火墙才允许发布'],
  ];
  notes.forEach(([k, v], i) => {
    const y = 5.72 + i * 0.4;
    s.addShape(pres.ShapeType.ellipse, {
      x: M + 0.04, y: y + 0.09, w: 0.09, h: 0.09,
      fill: { color: C.green }, line: { color: C.green, width: 0.5 },
    });
    txt(s, k, M + 0.3, y, 2.6, 0.28, { fontSize: 12, bold: true, color: C.text });
    txt(s, v, M + 3.0, y + 0.01, CW - 3.0, 0.28, { fontSize: 11.5, color: C.mute });
  });

  footer(s, '亮点 03 · Validator 输出防火墙');
  s.addNotes('这一页回答「你怎么保证输出质量」。关键不是「有个 Validator」，而是校验失败码能直接驱动恢复动作，形成闭环。');
}

/* ═══ 08 · HIGHLIGHT 04 — ROLLBACK ENGINE ═══════════════ */
{
  const s = newSlide(BG_CONTENT);
  header(s, '亮点 04 / SELF-HEALING', 'Rollback 自愈引擎：四级恢复阶梯', '失败不是终点，而是恢复流程的入口 —— 由 Rollback Agent 决策，确定性兜底');

  const ladder = [
    ['L1', 'snapshot_restore', '快照回滚', '复用最近一次通过校验的输出，瞬时恢复，零 Token 成本', C.green],
    ['L2', 'model_switch', '模型切换', '按 Experience Memory 的历史成功率排序，依次换模型重跑', C.blue],
    ['L3', 'rerun', '原模型重跑', '无可用备选时以原模型重试，覆盖瞬时抖动类故障', C.amber],
    ['L4', 'human_escalation', '人工升级', '生成含失败原因与操作建议的工单，推送到前端等待介入', C.red],
  ];
  ladder.forEach(([lv, en, cn, desc, color], i) => {
    const y = 2.2 + i * 0.98;
    panel(s, M, y, CW * 0.72, 0.84);
    s.addShape(pres.ShapeType.roundRect, {
      x: M + 0.22, y: y + 0.19, w: 0.5, h: 0.46, rectRadius: 0.05,
      fill: { color: '0B1730', transparency: 10 }, line: { color, width: 1 },
    });
    txt(s, lv, M + 0.22, y + 0.19, 0.5, 0.46, {
      fontFace: F.mono, fontSize: 12, bold: true, color, align: 'center', valign: 'middle',
    });
    txt(s, cn, M + 0.92, y + 0.14, 1.5, 0.3, { fontSize: 15, bold: true, color: C.white });
    mono(s, en, M + 0.92, y + 0.48, 2.2, { fontSize: 8.5, color: C.mute, charSpacing: 0.6 });
    vline(s, M + 3.25, y + 0.18, 0.48, C.line, 0.75);
    txt(s, desc, M + 3.5, y + 0.28, CW * 0.72 - 3.75, 0.3, { fontSize: 11.5, color: C.dim });
    if (i < 3) mono(s, '↓', M + 0.34, y + 0.68, 0.3, { fontSize: 9, color: C.line });
  });

  const rx = M + CW * 0.72 + 0.36, rw = CW - CW * 0.72 - 0.36;
  panel(s, rx, 2.2, rw, 3.78, { fill: '0E1D38', transparency: 22, line: C.lineHi });
  txt(s, '决策而非硬编码', rx + 0.32, 2.44, rw - 0.64, 0.3, { fontSize: 15, bold: true, color: C.white });
  txt(s, 'Rollback Agent 读取错误类型、可用快照与备选模型，输出结构化恢复决策；决策失败时退回确定性兜底。',
    rx + 0.32, 2.86, rw - 0.64, 1.1, { fontSize: 11.5, color: C.dim, lineSpacingMultiple: 1.45 });

  hairline(s, rx + 0.32, 4.08, rw - 0.64, C.line, 0.75);

  txt(s, '全程可观测', rx + 0.32, 4.3, rw - 0.64, 0.3, { fontSize: 15, bold: true, color: C.white });
  txt(s, '每次恢复都广播 rollback 事件，携带策略、原模型、目标模型与耗时 —— DAG 节点实时变色，恢复过程看得见。',
    rx + 0.32, 4.72, rw - 0.64, 1.1, { fontSize: 11.5, color: C.dim, lineSpacingMultiple: 1.45 });

  txt(s, '错误分类覆盖 DATA_ERROR / MODEL_ERROR / TOOL_ERROR / POLICY_ERROR 四类，不同错误走不同恢复路径。',
    M, 6.26, CW, 0.3, { fontSize: 11.5, color: C.mute, italic: true });

  footer(s, '亮点 04 · 四级自愈回滚');
  s.addNotes('这是最能打动评委的一页。重点讲 L1：快照回滚是零成本恢复，别人的方案通常直接重跑烧钱。');
}

/* ═══ 09 · HIGHLIGHT 05 — EXPERIENCE MEMORY ═════════════ */
{
  const s = newSlide(BG_CONTENT);
  header(s, '亮点 05 / EXPERIENCE MEMORY', '经验记忆：系统跑得越多，选得越准', '把每一次成败都变成下一次的决策依据 —— 一个会自我进化的飞轮');

  // flywheel: three nodes in a cycle
  panel(s, M, 2.2, 6.4, 3.0);
  const cyc = [
    ['执行', 'EXECUTE', '每次 Agent 调用记录\nrole × model × taskType', C.blue],
    ['沉淀', 'RECORD', '成败结果持久化写入\nexperience.json', C.cyan],
    ['决策', 'DECIDE', '按成功率排序\n选模型与回退', C.green],
  ];
  cyc.forEach(([cn, en, desc, color], i) => {
    const x = M + 0.3 + i * 2.0;
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 2.62, w: 1.7, h: 1.6, rectRadius: 0.05,
      fill: { color: '0B1730', transparency: 12 }, line: { color, width: 1 },
    });
    mono(s, en, x, 2.8, 1.7, { fontSize: 8, color, align: 'center' });
    txt(s, cn, x, 3.06, 1.7, 0.32, { fontSize: 17, bold: true, color: C.white, align: 'center' });
    txt(s, desc, x, 3.48, 1.7, 0.62, { fontSize: 10, color: C.mute, align: 'center', lineSpacingMultiple: 1.3 });
    if (i < 2) arrow(s, x + 1.78, 3.42, 0.16);
  });
  s.addShape(pres.ShapeType.line, {
    x: M + 0.18, y: 4.46, w: 5.94, h: 0,
    line: { color: C.lineHi, width: 0.9, beginArrowType: 'triangle' },
  });
  vline(s, M + 6.12, 3.42, 1.04, C.lineHi, 0.9);
  vline(s, M + 0.18, 3.42, 1.04, C.lineHi, 0.9);
  txt(s, '闭环回流：本轮的失败，是下一轮的先验', M + 0.18, 4.58, 5.94, 0.28, {
    fontSize: 10.5, color: C.mute, align: 'center',
  });

  const rx = M + 6.8, rw = CW - 6.8;
  const uses = [
    ['pickModel()', '正向选型', '按角色 × 模型 × 任务类型的历史成功率挑选执行模型', C.blue],
    ['pickFallback()', '回退排序', '回滚时把最可能成功的备选模型排到最前，减少无效重试', C.green],
  ];
  uses.forEach(([fn, cn, desc, color], i) => {
    const y = 2.2 + i * 1.56;
    panel(s, rx, y, rw, 1.4, { transparency: 30 });
    mono(s, fn, rx + 0.32, y + 0.22, 2.2, { fontSize: 10, color, bold: true, charSpacing: 0.4 });
    txt(s, cn, rx + 0.32, y + 0.52, rw - 0.64, 0.3, { fontSize: 15, bold: true, color: C.white });
    txt(s, desc, rx + 0.32, y + 0.9, rw - 0.64, 0.4, { fontSize: 11.5, color: C.mute, lineSpacingMultiple: 1.35 });
  });

  panel(s, M, 5.44, CW, 1.0, { fill: '0E1D38', transparency: 20, line: C.lineHi });
  txt(s, '大多数框架的模型配置是静态的 —— 写死在配置文件里，好不好用全凭人工经验。',
    M + 0.44, 5.6, CW - 0.88, 0.3, { fontSize: 12, color: C.dim });
  txt(s, 'Hermes 让运行数据自己说话：跑得越久，模型路由与恢复顺序越贴合真实表现。',
    M + 0.44, 5.96, CW - 0.88, 0.3, { fontSize: 13.5, bold: true, color: C.white });

  footer(s, '亮点 05 · Experience Memory');
  s.addNotes('这一页讲「自我进化」。注意别吹成在线学习——它是基于执行结果的统计路由，简单但真实有效。');
}

/* ═══ 10 · HIGHLIGHT 06 — AI ROUNDTABLE ═════════════════ */
{
  const s = newSlide(BG_CONTENT);
  header(s, '亮点 06 / AI ROUNDTABLE', 'AI 圆桌：让智能体互相「吵」出更优解', '不是串行流水线，而是有主持人、有立场、有收敛机制的多轮辩论');

  const phases = [
    ['01', '目标确认', '主持人明确议题、\n成功标准与轮次'],
    ['02', '多轮发言', '参与者依序表态，\n提案 / 质疑 / 补充'],
    ['03', '共识合成', '汇总分歧与共识，\n产出可执行方案'],
    ['04', '防火墙校验', '最终方案须通过\nValidator 才发布'],
  ];
  const pw = (7.4 - 0.24 * 3) / 4;
  phases.forEach(([idx, title, desc], i) => {
    const x = M + i * (pw + 0.24);
    panel(s, x, 2.2, pw, 2.05);
    mono(s, idx, x + 0.24, 2.42, 0.5, { fontSize: 10, color: C.violet, bold: true });
    txt(s, title, x + 0.24, 2.74, pw - 0.48, 0.3, { fontSize: 14, bold: true, color: C.white });
    txt(s, desc, x + 0.24, 3.16, pw - 0.48, 0.86, { fontSize: 10.5, color: C.mute, lineSpacingMultiple: 1.35 });
    if (i < 3) arrow(s, x + pw + 0.04, 3.22, 0.16, C.line);
  });

  mono(s, 'STANCE  TAGS', M, 4.5, 2.4, { fontSize: 8.5, color: C.mute });
  const stances = [
    ['propose 提案', C.blue], ['challenge 质疑', C.red], ['supplement 补充', C.cyan],
    ['moderate 主持', C.violet], ['synthesize 收敛', C.green],
  ];
  let sx = M;
  stances.forEach(([label, color]) => {
    chip(s, label, sx, 4.8, 1.42, 0.38, color);
    sx += 1.5;
  });

  panel(s, M, 5.42, 7.4, 1.15, { fill: '0E1D38', transparency: 22, line: C.lineHi });
  txt(s, '收敛机制：最多 3 轮，主持人强制产出结论', M + 0.36, 5.58, 6.8, 0.3, {
    fontSize: 13.5, bold: true, color: C.white,
  });
  txt(s, '多智能体讨论最怕发散不收口。Moderator 承担议程控制与最终合成，输出「共识 / 分歧 / 执行任务 / 风险项」四段式结构化结果。',
    M + 0.36, 5.94, 6.8, 0.5, { fontSize: 11.5, color: C.dim, lineSpacingMultiple: 1.4 });

  const rx = M + 7.66, rw = CW - 7.66;
  panel(s, rx, 2.2, rw, 4.37, { transparency: 20 });
  mono(s, 'VISUALIZATION', rx + 0.34, 2.44, rw - 0.68, { fontSize: 8.5, color: C.cyan });
  txt(s, '3D 像素圆桌', rx + 0.34, 2.74, rw - 0.68, 0.4, { fontSize: 21, bold: true, color: C.white });
  hairline(s, rx + 0.34, 3.24, 0.7, C.cyan, 1);
  const viz = [
    ['Three.js + CSS2D 渲染', '七个席位环绕圆桌，可自由旋转视角'],
    ['思考态动画', '头部摆动 / 光环脉冲，实时反映谁在推理'],
    ['发言气泡', '持久展示每位智能体的观点摘要'],
    ['结论定格', '共识达成后统一呈现最终方案'],
  ];
  viz.forEach(([k, v], i) => {
    const y = 3.46 + i * 0.72;
    s.addShape(pres.ShapeType.ellipse, {
      x: rx + 0.36, y: y + 0.08, w: 0.09, h: 0.09,
      fill: { color: C.cyan }, line: { color: C.cyan, width: 0.5 },
    });
    txt(s, k, rx + 0.6, y, rw - 0.94, 0.26, { fontSize: 12, bold: true, color: C.text });
    txt(s, v, rx + 0.6, y + 0.28, rw - 0.94, 0.36, { fontSize: 10.5, color: C.mute, lineSpacingMultiple: 1.3 });
  });

  footer(s, '亮点 06 · AI 圆桌与 3D 可视化');
  s.addNotes('这是演示时最有记忆点的一页，直接切到 3D 圆桌现场跑。强调「有主持人、会收敛」是和普通群聊式多智能体的关键差别。');
}

/* ═══ 11 · HIGHLIGHT 07 — OBSERVABILITY ═════════════════ */
{
  const s = newSlide(BG_CONTENT);
  header(s, '亮点 07 / OBSERVABILITY', '全链路 Trace：每一步都留痕、可回放', '从上下文构建到模型调用再到输出校验，8 个阶段逐一埋点');

  const phases = ['START', 'CONTEXT_BUILD', 'MODEL_SELECTED', 'LLM_CALL', 'OUTPUT_VALIDATE', 'SNAPSHOT', 'SUCCESS', 'FAIL'];
  const colors = [C.mute, C.blue, C.blue, C.cyan, C.amber, C.violet, C.green, C.red];
  const tw = (CW - 0.13 * 7) / 8;
  hairline(s, M, 2.72, CW, C.line, 0.75);
  phases.forEach((p, i) => {
    const x = M + i * (tw + 0.13);
    s.addShape(pres.ShapeType.ellipse, {
      x: x + tw / 2 - 0.055, y: 2.665, w: 0.11, h: 0.11,
      fill: { color: colors[i] }, line: { color: colors[i], width: 0.5 },
    });
    panel(s, x, 2.94, tw, 0.62, { transparency: 34 });
    mono(s, p.replace('_', '\n'), x + 0.06, 3.02, tw - 0.12, {
      fontSize: 7.5, color: colors[i], align: 'center', h: 0.46, charSpacing: 0.4,
    });
  });
  txt(s, '每个阶段都带 模型 / Token / 成本 / 耗时 / 尝试次数，点击 DAG 节点即可展开完整执行时间线。',
    M, 3.74, CW, 0.3, { fontSize: 11.5, color: C.mute });

  const cards = [
    ['SNAPSHOT', '快照留痕', '每次执行的输入与输出双向落盘，既是回放素材，也是快照回滚的恢复源。', C.violet],
    ['TOKEN / COST', '成本透明', 'Token 按 Agent 归集、成本按模型归集，实时汇总到统计接口。', C.amber],
    ['DASHBOARD', '运行看板', '总运行数、成功率、Token 分布与智能体表现对比，一屏掌握全局。', C.cyan],
  ];
  const cw2 = (CW - 0.36 * 2) / 3;
  cards.forEach(([en, cn, desc, color], i) => {
    const x = M + i * (cw2 + 0.36);
    panel(s, x, 4.22, cw2, 1.9);
    mono(s, en, x + 0.34, 4.46, cw2 - 0.68, { fontSize: 8.5, color });
    txt(s, cn, x + 0.34, 4.78, cw2 - 0.68, 0.34, { fontSize: 18, bold: true, color: C.white });
    hairline(s, x + 0.34, 5.24, 0.6, color, 1);
    txt(s, desc, x + 0.34, 5.42, cw2 - 0.68, 0.6, { fontSize: 11, color: C.dim, lineSpacingMultiple: 1.4 });
  });

  txt(s, '可观测不是事后补的日志 —— 它是回滚决策的输入。没有 Trace 与 Snapshot，就没有自动恢复。',
    M, 6.36, CW, 0.3, { fontSize: 12, color: C.text, italic: true });

  footer(s, '亮点 07 · 全链路可观测');
  s.addNotes('把观测和治理的因果关系讲清楚：观测是自愈的前提，不是装饰性功能。');
}

/* ═══ 12 · CLOSED LOOP NARRATIVE ════════════════════════ */
{
  const s = newSlide(BG_SECTION);
  header(s, '04 / THE LOOP', '一次真实的自愈闭环，全程无人介入', '这是把前面所有能力串起来之后，系统实际发生的事');

  const steps = [
    ['用户发起任务', '「生成一份新能源行业战略分析周报」', C.blue],
    ['Planner 拆解', '识别出采集 / 调研 / 分析 / 撰写四类需求，生成带依赖的 DAG', C.blue],
    ['Analyst 调用超时', '错误被自动分类为 MODEL_ERROR，节点转入回滚态', C.red],
    ['Rollback 决策', '无可用快照 → 选择 model_switch，按经验记忆挑选备选模型重跑', C.amber],
    ['Validator 放行', '四维评分全部达标，输出解除拦截流向下游', C.green],
    ['Writer 成稿', '汇总上游结论产出报告，全过程 Trace 与成本可逐段回溯', C.green],
  ];
  const sw = (CW - 0.28 * 5) / 6;
  vline(s, M + sw / 2, 2.36, 0.001, C.line, 0.75);
  hairline(s, M + sw / 2, 2.48, CW - sw, C.line, 0.75);
  steps.forEach(([title, desc, color], i) => {
    const x = M + i * (sw + 0.28);
    s.addShape(pres.ShapeType.ellipse, {
      x: x + sw / 2 - 0.09, y: 2.39, w: 0.18, h: 0.18,
      fill: { color: color }, line: { color: color, width: 1 },
    });
    mono(s, 'STEP ' + (i + 1), x, 2.7, sw, { fontSize: 8, color: C.mute, align: 'center' });
    panel(s, x, 3.0, sw, 2.45, { transparency: 26 });
    txt(s, title, x + 0.18, 3.2, sw - 0.36, 0.64, {
      fontSize: 13.5, bold: true, color: C.white, align: 'center', lineSpacingMultiple: 1.2,
    });
    hairline(s, x + sw / 2 - 0.3, 3.98, 0.6, color, 1);
    txt(s, desc, x + 0.18, 4.16, sw - 0.36, 1.15, {
      fontSize: 10.5, color: C.dim, align: 'center', lineSpacingMultiple: 1.4,
    });
  });

  panel(s, M, 5.7, CW, 0.86, { fill: '0E1D38', transparency: 18, line: C.lineHi });
  txt(s, '同样的失败，在普通编排框架里是一条报错日志；在 Hermes 里，是一次被记录、被决策、被恢复的事件。',
    M + 0.44, 5.94, CW - 0.88, 0.4, { fontSize: 14.5, bold: true, color: C.white });

  footer(s, '端到端自愈闭环');
  s.addNotes('演示前先讲这条叙事线，观众带着这条线看 demo，理解成本最低。');
}

/* ═══ 13 · DEMO SCENARIO ════════════════════════════════ */
{
  const s = newSlide(BG_CONTENT);
  header(s, '05 / LIVE DEMO', '演示场景：新能源行业战略分析周报', '内置完整数据集与三条演示指令，离线也能跑通全链路');

  const kpis = [
    ['42.6', 'GWh', '储能上半年新增装机'],
    ['+58.3', '%', '储能装机同比增速'],
    ['128', 'GW', '光伏上半年新增装机'],
    ['54.7', '%', '新能源车零售渗透率'],
  ];
  const kw = (CW - 0.3 * 3) / 4;
  kpis.forEach(([num, unit, label], i) => {
    const x = M + i * (kw + 0.3);
    panel(s, x, 2.2, kw, 1.66);
    s.addText(
      [
        { text: num, options: { fontFace: F.en, fontSize: 40, bold: true, color: C.white } },
        { text: ' ' + unit, options: { fontFace: F.en, fontSize: 15, bold: true, color: C.blue } },
      ],
      { x: x + 0.3, y: 2.46, w: kw - 0.6, h: 0.7, margin: 0, valign: 'middle' },
    );
    hairline(s, x + 0.3, 3.26, 0.6, C.blue, 1);
    txt(s, label, x + 0.3, 3.44, kw - 0.6, 0.3, { fontSize: 11.5, color: C.mute });
  });

  const prompts = [
    ['TASK', '战略分析周报', '三条主线为框架，采集 → 调研 → 建议 → 成稿，要求区分事实与推断'],
    ['ROUNDTABLE', '哪条主线最值得优先配置', '四个智能体各司其职圆桌辩论，结论必须通过质检'],
    ['TASK', '分阶段配置策略评估', '基于预置数据，评估「先储能、后光伏、再新能源车」是否成立'],
  ];
  prompts.forEach(([tag, title, desc], i) => {
    const y = 4.1 + i * 0.76;
    panel(s, M, y, CW * 0.72, 0.64, { transparency: 34 });
    mono(s, tag, M + 0.26, y + 0.19, 1.15, { fontSize: 8, color: tag === 'TASK' ? C.blue : C.violet, bold: true });
    txt(s, title, M + 1.5, y + 0.16, 2.8, 0.3, { fontSize: 13, bold: true, color: C.white });
    vline(s, M + 4.4, y + 0.14, 0.36, C.line, 0.75);
    txt(s, desc, M + 4.64, y + 0.18, CW * 0.72 - 4.9, 0.3, { fontSize: 11, color: C.mute });
  });

  const rx = M + CW * 0.72 + 0.36, rw = CW - CW * 0.72 - 0.36;
  panel(s, rx, 4.1, rw, 2.2, { fill: '0E1D38', transparency: 20, line: C.lineHi });
  mono(s, 'MOCK_LLM = 1', rx + 0.32, 4.36, rw - 0.64, { fontSize: 9.5, color: C.green, bold: true });
  txt(s, '零依赖演示', rx + 0.32, 4.64, rw - 0.64, 0.36, { fontSize: 19, bold: true, color: C.white });
  txt(s, '没有 API Key 也能跑通：拆解、并行、拦截、自愈、圆桌与 Trace 全部真实执行，只有模型响应来自内置数据集。',
    rx + 0.32, 5.12, rw - 0.64, 1.05, { fontSize: 11.5, color: C.dim, lineSpacingMultiple: 1.45 });

  footer(s, '演示场景与数据');
  s.addNotes('评委席网络不可靠是常态。这一页的价值是：无论现场网络如何，demo 一定能跑完。演示数据为内置模拟数据集，如实说明。');
}

/* ═══ 14 · ENGINEERING QUALITY ══════════════════════════ */
{
  const s = newSlide(BG_CONTENT);
  header(s, '06 / ENGINEERING', '技术栈与工程质量', '不是一次性 Demo 代码 —— 按可维护、可验证的工程标准建设');

  panel(s, M, 2.2, 6.1, 3.8);
  txt(s, '技术栈', M + 0.4, 2.44, 5.3, 0.34, { fontSize: 17, bold: true, color: C.white });
  hairline(s, M + 0.4, 2.86, 0.7, C.blue, 1);
  const stack = [
    ['运行时', 'Node.js 20 · TypeScript · pnpm Monorepo'],
    ['服务端', 'Koa · Socket.IO · OpenAI 兼容网关'],
    ['前端', 'Vue 3 · Naive UI · Next.js 16 / React 19'],
    ['可视化', 'Three.js 3D 圆桌 · React Flow DAG 画布'],
    ['共享层', '@hermes/shared 端到端类型定义'],
  ];
  stack.forEach(([k, v], i) => {
    const y = 3.08 + i * 0.58;
    txt(s, k, M + 0.4, y, 1.1, 0.28, { fontSize: 12.5, bold: true, color: C.blue });
    txt(s, v, M + 1.6, y + 0.01, 4.1, 0.28, { fontSize: 11.5, color: C.dim });
  });

  const rx = M + 6.46, rw = CW - 6.46;
  panel(s, rx, 2.2, rw, 3.8);
  txt(s, '工程质量', rx + 0.4, 2.44, rw - 0.8, 0.34, { fontSize: 17, bold: true, color: C.white });
  hairline(s, rx + 0.4, 2.86, 0.7, C.green, 1);
  const quality = [
    ['端到端类型安全', '前后端共享 18 个事件契约，改协议即刻编译报错'],
    ['逻辑自测脚本', '600+ 行断言覆盖拆解、调度、回滚、圆桌与统计链路'],
    ['Mock 优先设计', '无网络无密钥即可完整回归，不依赖外部服务'],
    ['韧性默认开启', '5 次尝试 + 递增退避 + 四类错误分类兜底'],
    ['状态可持久化', '快照与经验记忆落盘，重启不丢历史'],
  ];
  quality.forEach(([k, v], i) => {
    const y = 3.08 + i * 0.58;
    s.addShape(pres.ShapeType.ellipse, {
      x: rx + 0.42, y: y + 0.09, w: 0.09, h: 0.09,
      fill: { color: C.green }, line: { color: C.green, width: 0.5 },
    });
    txt(s, k, rx + 0.68, y, 1.75, 0.28, { fontSize: 12.5, bold: true, color: C.text });
    txt(s, v, rx + 2.5, y + 0.01, rw - 2.9, 0.28, { fontSize: 11, color: C.mute });
  });

  txt(s, '把重试、校验、回滚、观测下沉到运行时，业务代码才敢薄 —— 这是能长期演进的前提。',
    M, 6.22, CW, 0.34, { fontSize: 12.5, color: C.mute, italic: true });

  footer(s, '技术栈与工程质量');
  s.addNotes('这一页给技术评委看。重点：Mock 优先和自测脚本说明我们考虑了可回归性，不是一锤子买卖。');
}

/* ═══ 15 · DIFFERENTIATION ══════════════════════════════ */
{
  const s = newSlide(BG_CONTENT);
  header(s, '07 / WHY US', '和通用编排框架的关键差别', '同样是多智能体，差别不在能不能跑通，而在跑不通时会发生什么');

  const rows = [
    ['输出质量', '依赖 Prompt 约束与人工复核', 'Schema + 四维评分防火墙，不合格直接拦截'],
    ['失败处理', '重试若干次，失败即抛错', '四级自愈阶梯，最终降级为带建议的人工工单'],
    ['模型选择', '静态配置，改模型要改代码', '经验记忆按历史成功率动态选型与排序回退'],
    ['可观测性', '打印日志，事后翻查', '8 阶段 Trace + 双向快照 + Token / 成本归集'],
    ['协作形态', '链式调用或主从分发', '有主持人、有立场、能收敛的圆桌辩论'],
  ];

  const c1 = 2.0, c2 = 4.3, c3 = CW - c1 - c2;
  const headY = 2.14;
  mono(s, '维度', M + 0.24, headY, c1, { fontSize: 9, color: C.mute });
  mono(s, '通用编排框架的常见做法', M + c1 + 0.24, headY, c2, { fontSize: 9, color: C.mute });
  mono(s, 'HERMES  AGENTOS', M + c1 + c2 + 0.24, headY, c3, { fontSize: 9, color: C.blue, bold: true });
  hairline(s, M, headY + 0.34, CW, C.lineHi, 1);

  rows.forEach(([dim, other, ours], i) => {
    const y = headY + 0.52 + i * 0.70;
    txt(s, dim, M + 0.24, y + 0.12, c1 - 0.3, 0.3, { fontSize: 13.5, bold: true, color: C.white });
    txt(s, other, M + c1 + 0.24, y + 0.14, c2 - 0.4, 0.3, { fontSize: 11.5, color: C.mute });
    s.addShape(pres.ShapeType.roundRect, {
      x: M + c1 + c2, y: y, w: c3, h: 0.6, rectRadius: 0.05,
      fill: { color: '0E1D38', transparency: 24 }, line: { color: C.line, width: 0.75 },
    });
    txt(s, ours, M + c1 + c2 + 0.24, y + 0.14, c3 - 0.48, 0.34, { fontSize: 11.5, color: C.text });
    if (i < rows.length - 1) hairline(s, M, y + 0.64, CW, C.line, 0.5);
  });

  txt(s, '我们不打算取代编排框架 —— 我们补的是它们普遍留白的那一层：治理。',
    M, 6.34, CW, 0.3, { fontSize: 12.5, color: C.dim, italic: true });

  footer(s, '差异化定位');
  s.addNotes('措辞刻意克制：说的是「通用编排框架的常见做法」，不点名具体产品，避免被评委抓事实性问题。');
}

/* ═══ 16 · ROADMAP & CLOSING ════════════════════════════ */
{
  const s = newSlide(BG_COVER);
  mono(s, '08 / WHAT’S NEXT', M, 0.62, 6, { fontSize: 10, color: C.blue, bold: true, charSpacing: 2.2 });
  txt(s, '从黑客松原型，到可托管的 Agent 基础设施', M, 0.96, 8.6, 0.5, {
    fontSize: 28, bold: true, color: C.white, lineSpacingMultiple: 1.0,
  });

  const road = [
    ['NEXT', 'LLM 规划器', '把规则式 Planner 升级为模型驱动的动态任务图生成', C.blue],
    ['THEN', 'Skill 市场与灰度', '基于 skill.json 版本做 A/B 与自动回滚，能力可分发', C.cyan],
    ['LATER', '成本护栏与多租户', '预算上限、配额隔离与团队级用量治理', C.violet],
  ];
  const rw2 = (CW - 0.36 * 2) / 3;
  road.forEach(([tag, title, desc, color], i) => {
    const x = M + i * (rw2 + 0.36);
    panel(s, x, 2.0, rw2, 1.98);
    mono(s, tag, x + 0.34, 2.24, 1.2, { fontSize: 8.5, color, bold: true });
    txt(s, title, x + 0.34, 2.56, rw2 - 0.68, 0.36, { fontSize: 17, bold: true, color: C.white });
    hairline(s, x + 0.34, 3.04, 0.6, color, 1);
    txt(s, desc, x + 0.34, 3.22, rw2 - 0.68, 0.62, { fontSize: 11.5, color: C.dim, lineSpacingMultiple: 1.4 });
  });

  hairline(s, M, 4.42, CW, C.line, 0.75);

  s.addText('Hermes AgentOS', {
    x: M, y: 4.78, w: 8.6, h: 0.72,
    fontFace: F.en, fontSize: 40, bold: true, color: C.white, margin: 0, valign: 'middle',
  });
  txt(s, '让多智能体，敢上生产。', M, 5.58, 8.6, 0.46, {
    fontSize: 22, color: C.blue, charSpacing: 2,
  });
  txt(s, '感谢观看 — 欢迎现场提问与实机演示', M, 6.14, 8.6, 0.32, { fontSize: 12.5, color: C.mute });

  mono(s, 'THANK  YOU', W - M - 3.4, 5.0, 3.4, { fontSize: 11, color: C.lineHi, align: 'right', bold: true, charSpacing: 3 });
  mono(s, 'liufelix2004 / hermes-agentos', W - M - 3.4, 5.34, 3.4, { fontSize: 9, color: C.mute, align: 'right' });

  footer(s, '路线图与致谢');
  s.addNotes('收尾留 30 秒给提问。准备好回答：成本、真实模型下的表现、以及和现有框架的集成方式。');
}

pres.writeFile({ fileName: 'Hermes-AgentOS-Hackathon.pptx' }).then(() => {
  console.log('deck written');
});
