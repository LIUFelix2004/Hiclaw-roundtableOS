<script setup lang="ts">
import { computed, ref } from 'vue'
import { NCard, NCollapse, NCollapseItem, NProgress, NTag } from 'naive-ui'
import MarkdownRenderer from '@/components/hermes/chat/MarkdownRenderer.vue'

const props = withDefaults(defineProps<{ content: string; isStreaming?: boolean }>(), { isStreaming: false })
const expandedAgents = ref<string[]>([])

const taskPlan = computed(() => props.content.match(/\*\*Task Plan:\*\*([\s\S]*?)(?=\n---|\n###|$)/i)?.[1]?.trim() || '')
const agentSections = computed(() => {
  const result: Array<{ name: string; body: string }> = []
  const regex = /###\s+([^\n]+)\s+Agent\s*([\s\S]*?)(?=\n###\s+|\n---\s*\n|$)/gi
  let match: RegExpExecArray | null
  while ((match = regex.exec(props.content))) result.push({ name: match[1].trim(), body: match[2].trim() })
  return result
})
const validation = computed(() => {
  const match = props.content.match(/\*\*Validation\s+(✅|❌)\*\*:?\s*([^\n]*)/i)
  if (!match) return null
  return { pass: match[1] === '✅', text: match[2] }
})
const findings = computed(() => [...props.content.matchAll(/-\s+\*\*([^*]+)\*\*:?\s*([^\n]*?)(?:\s*\(confidence:\s*(\d+)%\))?\s*$/gim)].map(match => ({ title: match[1], detail: match[2], confidence: Number(match[3] || 0) })))
const plainContent = computed(() => props.content
  .replace(/\*\*Task Plan:\*\*[\s\S]*?(?=\n---|\n###|$)/i, '')
  .replace(/###\s+[^\n]+\s+Agent[\s\S]*?(?=\n###\s+|\n---\s*\n|$)/gi, '')
  .trim())
</script>

<template>
  <div class="competition-message" :class="{ streaming: props.isStreaming }">
    <NCard v-if="taskPlan" size="small" class="structured-block task-plan" :bordered="false">
      <template #header>Task Plan</template>
      <MarkdownRenderer :content="taskPlan" />
    </NCard>
    <NCollapse v-if="agentSections.length" v-model:expanded-names="expandedAgents" class="agent-sections">
      <NCollapseItem v-for="section in agentSections" :key="section.name" :name="section.name" :title="`${section.name} Agent`">
        <MarkdownRenderer :content="section.body" />
      </NCollapseItem>
    </NCollapse>
    <NCard v-if="findings.length" size="small" class="structured-block findings" :bordered="false">
      <template #header>Key Findings</template>
      <div v-for="finding in findings" :key="finding.title" class="finding-row">
        <div><strong>{{ finding.title }}</strong><span>{{ finding.detail }}</span></div>
        <NProgress v-if="finding.confidence" type="line" :percentage="finding.confidence" :show-indicator="false" />
      </div>
    </NCard>
    <div v-if="validation" class="validation-row">
      <NTag :type="validation.pass ? 'success' : 'error'">{{ validation.pass ? 'Validation passed' : 'Validation failed' }}</NTag>
      <span>{{ validation.text }}</span>
    </div>
    <MarkdownRenderer v-if="plainContent" :content="plainContent" />
  </div>
</template>

<style scoped>
.competition-message { display: grid; gap: 10px; min-width: 0; }
.structured-block { background: color-mix(in srgb, var(--n-color, #fff) 88%, #0ea5e9); border: 1px solid rgba(14, 165, 233, .18); }
.agent-sections { border: 1px solid rgba(14, 165, 233, .16); border-radius: 8px; padding: 4px 10px; }
.finding-row { display: grid; gap: 4px; padding: 8px 0; border-bottom: 1px solid rgba(148, 163, 184, .18); }
.finding-row div { display: flex; gap: 8px; flex-wrap: wrap; }
.finding-row span { color: var(--text-secondary); }
.validation-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12px; }
.streaming { opacity: .96; }
</style>
