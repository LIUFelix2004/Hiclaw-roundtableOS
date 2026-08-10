<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { VueFlow, type Edge, type Node } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { NAlert, NEmpty, NTag } from 'naive-ui'
import CompetitionAgentNode from '@/components/hermes/competition/dag/CompetitionAgentNode.vue'
import { useCompetitionDagStore } from '@/stores/hermes/competition-dag'
import { useCompetitionTraceStore } from '@/stores/hermes/competition-trace'
const dag = useCompetitionDagStore()
const trace = useCompetitionTraceStore()
const nodes = computed<Node[]>(() => dag.tasks.map((task, index) => ({ id: task.id, type: 'competition-agent', position: { x: (index % 3) * 280, y: Math.floor(index / 3) * 160 }, data: { taskId: task.id, title: task.title, agent: task.agent } })))
const edges = computed<Edge[]>(() => dag.tasks.flatMap(task => task.dependsOn.map(parent => ({ id: `${parent}-${task.id}`, source: parent, target: task.id, animated: task.status === 'running', style: { stroke: '#111111' } }))))
function selectNode({ node }: { node: Node }) { dag.selectedTaskId = node.id; trace.selectedTraceId = node.data?.agent || null }
onMounted(() => { if (!dag.tasks.length) dag.setTaskPlan([]) })
</script>
<template>
  <main class="competition-view dag-view">
    <header class="view-header"><div><span class="eyebrow">AGENTOS</span><h1>执行 DAG</h1><p>多智能体任务实时编排</p></div><NTag type="info">已完成 {{ dag.overallProgress }}%</NTag></header>
    <NAlert v-if="!dag.tasks.length" type="info" :show-icon="false">发起一次对话以生成执行图。</NAlert>
    <div v-else class="flow-shell"><VueFlow id="competition-dag" :nodes="nodes" :edges="edges" fit-view-on-init @node-click="selectNode"><template #node-competition-agent="nodeProps"><CompetitionAgentNode v-bind="nodeProps" /></template><Background pattern-color="#94a3b8" :gap="24" /><Controls /><MiniMap /></VueFlow></div>
    <NEmpty v-if="!dag.tasks.length" description="暂无任务计划" />
  </main>
</template>
<style scoped>
.competition-view { height:100%; min-height:0; display:flex; flex-direction:column; gap:16px; padding:24px; background:var(--bg-page); }
.view-header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
.eyebrow { color:#111111; font-size:11px; font-weight:700; letter-spacing:.12em; }
h1 { margin:4px 0; font-size:24px; color:var(--text-primary); }
p { margin:0; color:var(--text-secondary); }
.flow-shell { flex:1; min-height:420px; border:1px solid var(--border-color); border-radius:8px; overflow:hidden; background:var(--bg-card, #fff); }
.vue-flow { width:100%; height:100%; }
</style>
