import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AgentRole, AgentTraceRecord, AgentSnapshot } from '@hermes/shared'

export const useCompetitionTraceStore = defineStore('competition-trace', () => {
  const traces = ref<AgentTraceRecord[]>([])
  const snapshots = ref<AgentSnapshot[]>([])
  const selectedTraceId = ref<string | null>(null)
  const selectedTrace = computed(() => traces.value.find(trace => trace.traceId === selectedTraceId.value) || null)

  function addTrace(payload: Partial<AgentTraceRecord> & Record<string, unknown>) {
    const traceId = String(payload.traceId || payload.id || `${payload.agent || 'agent'}-${Date.now()}`)
    const next: AgentTraceRecord = {
      traceId,
      agent: (payload.agent || 'research') as AgentRole,
      model: String(payload.model || ''),
      tokens: payload.tokens == null ? undefined : Number(payload.tokens),
      cost: payload.cost == null ? undefined : Number(payload.cost),
      duration: payload.duration == null ? undefined : Number(payload.duration),
      status: (payload.status || 'running') as AgentTraceRecord['status'],
      phase: payload.phase as AgentTraceRecord['phase'],
      attempt: payload.attempt == null ? undefined : Number(payload.attempt),
      message: payload.message == null ? undefined : String(payload.message),
    }
    const index = traces.value.findIndex(trace => trace.traceId === traceId)
    if (index >= 0) traces.value[index] = { ...traces.value[index], ...next }
    else traces.value.push(next)
    selectedTraceId.value = traceId
  }

  function addSnapshot(payload: AgentSnapshot) {
    snapshots.value.push(payload)
  }

  function reset() {
    traces.value = []
    snapshots.value = []
    selectedTraceId.value = null
  }

  return { traces, snapshots, selectedTraceId, selectedTrace, addTrace, addSnapshot, reset }
})
