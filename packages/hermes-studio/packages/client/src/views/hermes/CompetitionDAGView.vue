<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { VueFlow, type Edge, type Node } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { NAlert, NTag } from 'naive-ui'
import CompetitionAgentNode from '@/components/hermes/competition/dag/CompetitionAgentNode.vue'
import { useCompetitionDagStore } from '@/stores/hermes/competition-dag'
import { useCompetitionTraceStore } from '@/stores/hermes/competition-trace'
const dag = useCompetitionDagStore()
const trace = useCompetitionTraceStore()
const nodes = computed<Node[]>(() => dag.tasks.map((task, index) => ({ id: task.id, type: 'competition-agent', position: { x: (index % 3) * 280, y: Math.floor(index / 3) * 160 }, data: { taskId: task.id, title: task.title, agent: task.agent } })))
const edges = computed<Edge[]>(() => dag.tasks.flatMap(task => task.dependsOn.map(parent => ({ id: `${parent}-${task.id}`, source: parent, target: task.id, animated: task.status === 'running', style: { stroke: 'var(--text-primary, #111111)' } }))))
function selectNode({ node }: { node: Node }) { dag.selectedTaskId = node.id; trace.selectedTraceId = node.data?.agent || null }
onMounted(() => { if (!dag.tasks.length) dag.setTaskPlan([]) })
</script>
<template>
  <main class="competition-view dag-view">
    <header class="view-header"><div><span class="eyebrow">HICLAW</span><h1>执行 DAG</h1><p>多智能体任务实时编排</p></div><NTag type="info">已完成 {{ dag.overallProgress }}%</NTag></header>
    <NAlert v-if="!dag.tasks.length" type="info" :show-icon="false">
      <p style="margin:0 0 8px">此面板实时展示多智能体任务的执行流程图。</p>
      <p style="margin:0">请在「对话」页面发送消息，系统将自动规划 Research → Analyst → Writer 等子任务并在此展示 DAG 依赖关系与执行进度。</p>
    </NAlert>
    <div v-else class="flow-shell"><VueFlow id="competition-dag" :nodes="nodes" :edges="edges" fit-view-on-init @node-click="selectNode"><template #node-competition-agent="nodeProps"><CompetitionAgentNode v-bind="nodeProps" /></template><Background pattern-color="#94a3b8" :gap="24" /><Controls /><MiniMap /></VueFlow></div>
  </main>
</template>
<style scoped>
.competition-view { height:100%; min-height:0; display:flex; flex-direction:column; gap:16px; padding:24px; background:var(--bg-page); }
.view-header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
.eyebrow { color:var(--text-primary); font-size:11px; font-weight:700; letter-spacing:.12em; }
h1 { margin:4px 0; font-size:24px; color:var(--text-primary); }
p { margin:0; color:var(--text-secondary); }
.flow-shell { flex:1; min-height:420px; border:1px solid var(--border-color); border-radius:8px; overflow:hidden; background:var(--bg-card, #fff); }
.vue-flow { width:100%; height:100%; }
</style>
