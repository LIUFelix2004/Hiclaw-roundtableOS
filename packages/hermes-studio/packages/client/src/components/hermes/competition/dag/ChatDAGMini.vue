<script setup lang="ts">
import { computed } from 'vue'
import { VueFlow, type Edge, type Node } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import CompetitionAgentNode from './CompetitionAgentNode.vue'
import { useCompetitionDagStore } from '@/stores/hermes/competition-dag'

const dag = useCompetitionDagStore()
const nodes = computed<Node[]>(() => dag.tasks.map((task, index: number) => ({
  id: task.id,
  type: 'competition-agent',
  position: { x: 20, y: index * 100 + 20 },
  data: { taskId: task.id, title: task.title, agent: task.agent },
})))
const edges = computed<Edge[]>(() => dag.tasks.flatMap(task => task.dependsOn.map(parent => ({
  id: `${parent}-${task.id}`,
  source: parent,
  target: task.id,
  animated: task.status === 'running',
  style: { stroke: '#0ea5e9' },
}))))
</script>

<template>
  <div class="chat-dag-mini">
    <div v-if="!dag.tasks.length" class="dag-empty">
      <div class="dag-empty-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" opacity=".3"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="12" cy="18" r="3"/><line x1="8.5" y1="7.5" x2="10.5" y2="16"/><line x1="15.5" y1="7.5" x2="13.5" y2="16"/></svg></div>
      <span>Waiting for task plan...</span>
    </div>
    <VueFlow v-else id="chat-dag-mini" :nodes="nodes" :edges="edges" :nodes-draggable="false" :nodes-connectable="false" :zoom-on-scroll="false" :pan-on-drag="false" fit-view-on-init>
      <template #node-competition-agent="nodeProps"><CompetitionAgentNode v-bind="nodeProps" :compact="true" /></template>
      <Background pattern-color="#94a3b8" :gap="20" />
    </VueFlow>
    <div class="dag-summary"><span class="dag-stat"><span class="dot dot--running"></span>{{ dag.runningCount }} running</span><span class="dag-stat"><span class="dot dot--success"></span>{{ dag.completedCount }} done</span></div>
  </div>
</template>

<style scoped>
.chat-dag-mini { display:flex; flex-direction:column; height:100%; }
.dag-empty { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:var(--text-muted); font-size:12px; }
.vue-flow { flex:1; min-height:0; }
.dag-summary { display:flex; gap:12px; padding:8px 12px; border-top:1px solid var(--border-color); font-size:11px; color:var(--text-secondary); }
.dag-stat { display:flex; align-items:center; gap:4px; }.dot { width:6px; height:6px; border-radius:50%; }.dot--running { background:#3b82f6; animation:pulse 1.5s infinite; }.dot--success { background:#22c55e; }
@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }
</style>
