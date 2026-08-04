export interface NewEnergyPrompt {
  id: string;
  title: string;
  type: 'task' | 'roundtable';
  prompt: string;
}

/**
 * High-quality demo prompts for the new-energy strategic analysis scenario.
 * These are the inputs used to drive the multi-agent task pipeline and the
 * roundtable engine during an offline demo.
 */
export const NEW_ENERGY_PROMPTS: NewEnergyPrompt[] = [
  {
    id: 'new-energy-weekly',
    title: '新能源行业战略分析周报',
    type: 'task',
    prompt:
      '生成一份新能源行业战略分析周报：以储能、光伏、新能源车三条主线为框架，先采集市场数据，再研究行业动态，随后给出分阶段配置建议，最后输出可直接发布的报告。要求区分事实与推断、标注数据来源，并在结尾列出风险提示。',
  },
  {
    id: 'new-energy-roundtable',
    title: '新能源圆桌：哪条主线最值得优先配置',
    type: 'roundtable',
    prompt:
      '发起新能源圆桌讨论：储能、光伏、新能源车三条主线中，当前哪条最值得优先配置？要求 Data 提供装机与渗透率数据，Research 分析供需与政策，Analyst 给出分阶段建议，Writer 汇总成可执行方案，最后必须通过 Validator 质检。',
  },
  {
    id: 'new-energy-stage-strategy',
    title: '基于预置数据的阶段配置评估',
    type: 'task',
    prompt:
      '基于以下新能源预置数据，评估“先储能、后光伏、再新能源车”的分阶段配置策略是否成立，并输出一份战略分析周报：储能 2026H1 新增装机 42.6GWh、同比 +58.3%；光伏 2026H1 新增装机 128GW、同比 +12.4%；新能源车零售渗透率 54.7%；储能系统均价 0.58 元/Wh。',
  },
];

export const NEW_ENERGY_DATASET = {
  period: '2026-07-27 至 2026-08-02',
  storage: {
    gwh: 42.6,
    yoy: 0.583,
    systemPriceYuanPerWh: 0.58,
    qoq: -0.041,
  },
  solar: {
    gw: 128,
    yoy: 0.124,
  },
  ev: {
    penetration: 0.547,
  },
  policy: ['电力现货市场化交易推进', '强制配储政策逐步退坡'],
  sources: ['演示数据源-01', '演示数据源-02', '演示数据源-03', '演示数据源-04'],
  notes: ['全部为 Mock 演示数据，字段结构与真实数据源一致'],
};
