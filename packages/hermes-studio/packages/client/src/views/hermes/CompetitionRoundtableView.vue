<script setup lang="ts">
import { computed } from 'vue'
import { NSpin, NTag } from 'naive-ui'
import TopicInput from '@/components/hermes/competition/roundtable/TopicInput.vue'
import SpeechCard from '@/components/hermes/competition/roundtable/SpeechCard.vue'
import ConsensusCard from '@/components/hermes/competition/roundtable/ConsensusCard.vue'
import { useCompetitionRoundtableStore } from '@/stores/hermes/competition-roundtable'
const roundtable = useCompetitionRoundtableStore()
const orderedSpeeches = computed(() => [...roundtable.speeches].sort((a, b) => a.round - b.round))
function start(config: any) { roundtable.startRoundtable(config) }
</script>
<template><main class="competition-view roundtable-view"><header class="view-header"><div><span class="eyebrow">AGENTOS</span><h1>AI 圆桌会议</h1><p>多智能体并行辩论、质疑与综合，输出统一结论</p></div><NTag :type="roundtable.isRunning ? 'warning' : 'default'">{{ roundtable.isRunning ? `第 ${roundtable.activeRound} 轮` : '就绪' }}</NTag></header><TopicInput @start="start" /><div v-if="roundtable.isRunning && !orderedSpeeches.length" class="loading"><NSpin size="small" /> 等待首个发言</div><section class="speeches"><SpeechCard v-for="speech in orderedSpeeches" :key="`${speech.round}-${speech.agent}-${speech.content.slice(0, 12)}`" :speech="speech" /></section><ConsensusCard v-if="roundtable.consensus" :consensus="roundtable.consensus" /></main></template>
<style scoped>.competition-view{min-height:100%;display:flex;flex-direction:column;gap:16px;padding:24px;background:var(--bg-page)}.view-header{display:flex;justify-content:space-between;gap:16px}.eyebrow{color:#111111;font-size:11px;font-weight:700;letter-spacing:.12em}h1{margin:4px 0;font-size:24px;color:var(--text-primary)}p{margin:0;color:var(--text-secondary)}.speeches{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px}.loading{display:flex;align-items:center;gap:8px;color:var(--text-secondary)}</style>
