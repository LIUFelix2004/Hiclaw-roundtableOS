<script setup lang="ts">
import { ref, computed } from 'vue'
import { NTag } from 'naive-ui'
import MarkdownRenderer from '@/components/hermes/chat/MarkdownRenderer.vue'
import type { RoundtableConsensus } from '@hermes/shared'

const props = defineProps<{ consensus: RoundtableConsensus }>()
const expanded = ref(false)

const rawContent = computed(() => {
  const raw = props.consensus.finalAnswer || props.consensus.finalSolution || ''
  return typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2)
})

const briefSummary = computed(() => {
  const plain = rawContent.value.replace(/[#*\n{}"]+/g, ' ').replace(/\s+/g, ' ').trim()
  return plain.slice(0, 100) + (plain.length > 100 ? '...' : '')
})
</script>

<template>
  <div class="consensus-bar" :class="{ expanded }" @click="expanded = !expanded">
    <div class="bar-header">
      <span class="bar-icon">✓</span>
      <strong>统一结论</strong>
      <NTag size="tiny" type="success" :bordered="false">{{ consensus.rounds }} 轮</NTag>
    </div>
    <p class="bar-summary">{{ briefSummary }}</p>
    <div v-if="expanded" class="bar-detail" @click.stop>
      <MarkdownRenderer :content="rawContent" />
      <div v-if="consensus.risks?.length" class="bar-risks">
        <strong>风险提示</strong>
        <ul>
          <li v-for="(risk, i) in consensus.risks" :key="i">{{ typeof risk === 'string' ? risk : JSON.stringify(risk) }}</li>
        </ul>
      </div>
    </div>
    <span class="bar-toggle">{{ expanded ? '收起' : '展开详情' }}</span>
  </div>
</template>

<style scoped>
.consensus-bar {
  padding: 10px 14px;
  border-radius: 8px;
  border: 1.5px solid #22c55e;
  background: linear-gradient(135deg, rgba(34,197,94,.06), rgba(34,197,94,.02));
  cursor: pointer;
  transition: box-shadow .15s ease;
}
.consensus-bar:hover { box-shadow: 0 2px 12px rgba(34,197,94,.12); }
.consensus-bar.expanded { border-color: #16a34a; }
.bar-header { display: flex; align-items: center; gap: 6px; }
.bar-icon { color: #22c55e; font-size: 14px; font-weight: 700; }
.bar-header strong { font-size: 13px; color: var(--text-primary); flex: 1; }
.bar-summary { margin: 6px 0 0; font-size: 12px; color: var(--text-secondary); line-height: 1.5; }
.bar-detail { margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(34,197,94,.2); font-size: 13px; cursor: text; max-height: 400px; overflow-y: auto; }
.bar-risks { margin-top: 8px; }
.bar-risks strong { font-size: 12px; color: var(--text-secondary); }
.bar-risks ul { margin: 4px 0 0; padding-left: 16px; font-size: 12px; color: var(--text-secondary); }
.bar-risks li { margin-bottom: 2px; }
.bar-toggle { display: block; margin-top: 4px; font-size: 11px; color: #22c55e; text-align: right; }
</style>
