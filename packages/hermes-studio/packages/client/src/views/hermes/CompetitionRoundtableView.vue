<script setup lang="ts">
import { computed } from 'vue'
import { NSpin, NTag } from 'naive-ui'
import TopicInput from '@/components/hermes/competition/roundtable/TopicInput.vue'
import SpeechCard from '@/components/hermes/competition/roundtable/SpeechCard.vue'
import ConsensusCard from '@/components/hermes/competition/roundtable/ConsensusCard.vue'
import PixelRoundtable3D from '@/components/hermes/competition/roundtable/PixelRoundtable3D.vue'
import { useCompetitionRoundtableStore } from '@/stores/hermes/competition-roundtable'
const roundtable = useCompetitionRoundtableStore()
const orderedSpeeches = computed(() => [...roundtable.speeches].sort((a, b) => a.round - b.round))
function start(config: any) { roundtable.startRoundtable(config) }
</script>
<template>
  <main class="competition-view roundtable-view">
    <header class="view-header">
      <div><span class="eyebrow">HICLAW</span><h1>AI 圆桌会议</h1><p>多智能体并行辩论、质疑与综合，输出统一结论</p></div>
      <div class="status-row">
        <NTag v-if="roundtable.totalTokens > 0" size="small">{{ roundtable.totalTokens.toLocaleString() }} tokens</NTag>
        <NTag :type="roundtable.isRunning ? 'warning' : roundtable.phase === 'done' ? 'success' : 'default'">{{ roundtable.phase === 'synthesizing' ? '综合分析中...' : roundtable.isRunning ? `第 ${roundtable.activeRound} 轮` : roundtable.phase === 'done' ? '已完成' : '就绪' }}</NTag>
      </div>
    </header>
    <TopicInput @start="start" />
    <PixelRoundtable3D :speeches="orderedSpeeches" :is-running="roundtable.isRunning" :active-round="roundtable.activeRound" :thinking-agent="roundtable.thinkingAgent" :consensus="roundtable.consensus" />
    <div v-if="roundtable.isRunning && !orderedSpeeches.length" class="loading"><NSpin size="small" /> 等待首个发言</div>
    <div v-else-if="roundtable.phase === 'synthesizing'" class="loading"><NSpin size="small" /> 主持人正在综合各方观点，生成最终结论...</div>
    <section v-if="orderedSpeeches.length" class="speeches">
      <SpeechCard v-for="speech in orderedSpeeches" :key="`${speech.round}-${speech.agent}`" :speech="speech" />
    </section>
    <ConsensusCard v-if="roundtable.consensus" :consensus="roundtable.consensus" />
  </main>
</template>
<style scoped>
.competition-view { min-height: 100%; display: flex; flex-direction: column; gap: 12px; padding: 24px; background: var(--bg-page); }
.view-header { display: flex; justify-content: space-between; gap: 16px; }
.eyebrow { color: var(--text-primary); font-size: 11px; font-weight: 700; letter-spacing: .12em; }
h1 { margin: 4px 0; font-size: 24px; color: var(--text-primary); }
p { margin: 0; color: var(--text-secondary); }
.speeches { display: flex; flex-wrap: wrap; gap: 8px; }
.speeches > * { flex: 0 0 auto; min-width: 160px; max-width: 240px; }
.loading { display: flex; align-items: center; gap: 8px; color: var(--text-secondary); }
.status-row { display: flex; gap: 8px; align-items: center; }
</style>
