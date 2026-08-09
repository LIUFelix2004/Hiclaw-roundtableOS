<script setup lang="ts">
import { computed } from 'vue'
import { NProgress, NTag } from 'naive-ui'
import { useCompetitionDagStore } from '@/stores/hermes/competition-dag'
const dag = useCompetitionDagStore()
const competitionMode = typeof __COMPETITION_MODE__ !== 'undefined' && __COMPETITION_MODE__
const label = computed(() => dag.tasks.length ? `${dag.completedCount}/${dag.tasks.length} agents complete` : 'Waiting for task plan')
</script>
<template>
  <div class="agent-progress" v-if="competitionMode">
    <div class="agent-progress-head"><span>{{ label }}</span><NTag size="small" :bordered="false">{{ dag.overallProgress }}%</NTag></div>
    <NProgress type="line" :percentage="dag.overallProgress" :show-indicator="false" />
  </div>
</template>
<style scoped>
.agent-progress { position: absolute; z-index: 3; top: 10px; left: 50%; transform: translateX(-50%); width: min(520px, calc(100% - 32px)); padding: 9px 12px; border: 1px solid rgba(14,165,233,.2); border-radius: 8px; background: color-mix(in srgb, var(--bg-card, #fff) 90%, #0ea5e9); backdrop-filter: blur(10px); }
.agent-progress-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; font-size:11px; color:var(--text-secondary); }
</style>
