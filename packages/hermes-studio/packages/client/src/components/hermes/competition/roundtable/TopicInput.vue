<script setup lang="ts">
import { ref } from 'vue'
import { NButton, NInput, NInputNumber, NSelect } from 'naive-ui'
import type { AgentRole } from '@hermes/shared'
const emit = defineEmits<{ start: [config: { topic: string; agents: AgentRole[]; maxRounds: number }] }>()
const topic = ref('')
const maxRounds = ref(3)
const agents = ref<AgentRole[]>(['research', 'analyst', 'writer', 'validator'])
const options = ['research', 'analyst', 'data', 'writer', 'validator', 'moderator'].map(value => ({ label: value, value }))
function submit() { if (topic.value.trim()) emit('start', { topic: topic.value.trim(), agents: agents.value, maxRounds: maxRounds.value }) }
</script>
<template><div class="topic-input"><NInput v-model:value="topic" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" placeholder="请输入 AI 圆桌会议的讨论主题" @keyup.ctrl.enter="submit" /><div class="topic-controls"><NSelect v-model:value="agents" multiple :options="options" /><NInputNumber v-model:value="maxRounds" :min="1" :max="8" /><NButton type="primary" :disabled="!topic.trim()" @click="submit">发起圆桌</NButton></div></div></template>
<style scoped>.topic-input{display:grid;gap:10px}.topic-controls{display:grid;grid-template-columns:minmax(180px,1fr) 100px auto;gap:8px}@media(max-width:640px){.topic-controls{grid-template-columns:1fr}.topic-controls :deep(.n-button){width:100%}}</style>
