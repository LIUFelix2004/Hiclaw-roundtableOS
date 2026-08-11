<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position, type NodeProps } from '@vue-flow/core'
import { NProgress, NTag } from 'naive-ui'
import { useCompetitionDagStore } from '@/stores/hermes/competition-dag'
const props = defineProps<NodeProps<{ taskId: string; title: string; agent: string }> & { compact?: boolean }>()
const dag = useCompetitionDagStore()
const status = computed(() => dag.agentStatuses[props.data.agent])
const task = computed(() => dag.tasks.find(item => item.id === props.data.taskId))
</script>
<template>
  <div class="competition-node" :class="[`status-${task?.status || status?.status || 'pending'}`, { compact: props.compact }]" @click="dag.selectedTaskId = props.data.taskId">
    <Handle type="target" :position="Position.Left" />
    <div class="node-head"><span class="node-agent">{{ props.data.agent }}</span><NTag size="tiny" :type="task?.status === 'success' ? 'success' : task?.status === 'failed' ? 'error' : 'info'">{{ {pending:'待处理',running:'运行中',success:'成功',failed:'失败',rollback:'回滚'}[task?.status] || task?.status || '待处理' }}</NTag></div>
    <div class="node-title">{{ props.data.title }}</div>
    <NProgress v-if="!props.compact" type="line" :percentage="status?.progress || (task?.status === 'success' ? 100 : 0)" :show-indicator="false" />
    <Handle type="source" :position="Position.Right" />
  </div>
</template>
<style scoped>
.competition-node { width: 210px; padding: 12px; border: 1px solid rgba(14,165,233,.24); border-radius: 8px; background: var(--bg-card, #fff); box-shadow: 0 12px 28px rgba(15,23,42,.12); transition: transform .2s, border-color .2s; }
.competition-node:hover { transform: translateY(-2px); border-color: #111111; }
.competition-node.compact { width: 180px; padding: 8px; }
.status-running { border-color: #f59e0b; }
.status-success { border-color: #22c55e; }
.status-failed, .status-rollback { border-color: #ef4444; }
.node-head { display:flex; justify-content:space-between; gap:8px; align-items:center; margin-bottom:8px; }
.node-agent { font-size:11px; font-weight:700; text-transform:uppercase; color:#111111; }
.node-title { min-height:34px; margin-bottom:8px; font-size:13px; font-weight:600; color:var(--text-primary); }
.compact .node-head { margin-bottom: 3px; }
.compact .node-title { min-height: 0; margin-bottom: 0; font-size: 11px; }
</style>
