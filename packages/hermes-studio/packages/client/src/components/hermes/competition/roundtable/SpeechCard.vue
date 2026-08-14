<script setup lang="ts">
import { ref, computed } from 'vue'
import { NCard, NTag } from 'naive-ui'
import MarkdownRenderer from '@/components/hermes/chat/MarkdownRenderer.vue'
import type { RoundtableSpeech } from '@hermes/shared'

const props = defineProps<{ speech: RoundtableSpeech }>()
const expanded = ref(false)

const agentNames: Record<string, string> = {
  research: '研究员', analyst: '分析师', writer: '撰稿员', data: '数据员',
  validator: '验证员', moderator: '主持人', rollback: '回滚员',
}

const stanceLabels: Record<string, string> = {
  propose: '提议', challenge: '质疑', supplement: '补充',
  moderate: '主持', synthesize: '综合',
}

const summary = computed(() => {
  const raw = props.speech.content.replace(/[#*\n{}"]+/g, ' ').replace(/\s+/g, ' ').trim()
  return raw.slice(0, 18) + (raw.length > 18 ? '...' : '')
})

const name = computed(() => agentNames[props.speech.agent] || props.speech.agent)
const stanceLabel = computed(() => stanceLabels[props.speech.stance] || props.speech.stance)
</script>

<template>
  <div class="speech-chip" :class="{ expanded }" @click="expanded = !expanded">
    <div class="chip-header">
      <span class="chip-agent">{{ name }}</span>
      <NTag size="tiny" :bordered="false">R{{ speech.round }} · {{ stanceLabel }}</NTag>
    </div>
    <p class="chip-summary">{{ summary }}</p>
    <div v-if="expanded" class="chip-detail" @click.stop>
      <MarkdownRenderer :content="speech.content" />
      <div class="chip-meta">{{ speech.model || 'auto' }}</div>
    </div>
  </div>
</template>

<style scoped>
.speech-chip {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color, #e5e7eb);
  background: var(--bg-card, #fff);
  cursor: pointer;
  transition: box-shadow .15s ease, border-color .15s ease;
}
.speech-chip:hover { border-color: var(--accent-primary, #6366f1); box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.speech-chip.expanded { border-color: var(--accent-primary, #6366f1); }
.chip-header { display: flex; justify-content: space-between; align-items: center; }
.chip-agent { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.chip-summary { margin: 4px 0 0; font-size: 12px; color: var(--text-secondary); line-height: 1.4; }
.chip-detail { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border-color, #e5e7eb); font-size: 13px; cursor: text; max-height: 300px; overflow-y: auto; }
.chip-meta { margin-top: 6px; font-size: 10px; color: var(--text-muted, #94a3b8); }
</style>
