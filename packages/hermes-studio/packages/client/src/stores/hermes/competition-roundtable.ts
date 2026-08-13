import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AgentRole, RoundtableConfig, RoundtableConsensus, RoundtableSpeech } from '@hermes/shared'
import { connectChatRun, getChatRunSocket } from '@/api/hermes/chat'

export const useCompetitionRoundtableStore = defineStore('competition-roundtable', () => {
  const topic = ref('')
  const agents = ref<AgentRole[]>(['research', 'analyst', 'writer', 'validator'])
  const maxRounds = ref(3)
  const speeches = ref<RoundtableSpeech[]>([])
  const consensus = ref<RoundtableConsensus | null>(null)
  const isRunning = ref(false)
  const totalTokens = ref(0)
  const phase = ref<'idle' | 'discussing' | 'synthesizing' | 'done'>('idle')
  const thinkingAgent = ref<AgentRole | null>(null)
  const activeRound = computed(() => speeches.value.length ? Math.max(...speeches.value.map(speech => speech.round)) : 0)

  function getSocket() {
    return getChatRunSocket('chat-run') || connectChatRun(null, 'chat-run')
  }

  function startRoundtable(config: RoundtableConfig) {
    topic.value = config.topic
    agents.value = config.agents
    maxRounds.value = config.maxRounds || 3
    speeches.value = []
    consensus.value = null
    isRunning.value = true
    totalTokens.value = 0
    phase.value = 'discussing'

    const socket = getSocket()

    socket.off('roundtable:speech')
    socket.off('roundtable:consensus')
    socket.off('roundtable:done')
    socket.off('roundtable:error')
    socket.off('agent:output')
    socket.off('agent:status')

    socket.on('agent:status', (data: any) => {
      if (data?.status === 'running') {
        thinkingAgent.value = data.agent as AgentRole
      } else if (data?.status === 'success' || data?.status === 'failed') {
        if (thinkingAgent.value === data.agent) thinkingAgent.value = null
      }
    })

    socket.on('roundtable:speech', (data: Partial<RoundtableSpeech>) => {
      addSpeech(data)
      if (data.stance === 'synthesize') {
        phase.value = 'done'
        isRunning.value = false
      } else if (data.round && data.round > maxRounds.value) {
        phase.value = 'synthesizing'
      }
    })

    socket.on('agent:output', (data: any) => {
      if (data?.tokens) totalTokens.value += data.tokens
    })

    socket.on('roundtable:consensus', (data: RoundtableConsensus) => {
      setConsensus(data)
    })

    socket.on('roundtable:done', () => {
      if (phase.value !== 'done') {
        phase.value = 'done'
        isRunning.value = false
      }
    })

    socket.on('roundtable:error', () => {
      phase.value = 'done'
      isRunning.value = false
    })

    socket.emit('roundtable:start', { topic: config.topic, agents: config.agents, maxRounds: maxRounds.value })
  }

  function parseContent(raw: string): string {
    try {
      const obj = JSON.parse(raw)
      if (obj && typeof obj === 'object') {
        const parts: string[] = []
        if (obj.summary) parts.push(obj.summary)
        if (obj.findings?.length) {
          parts.push('\n**研究发现：**')
          for (const f of obj.findings) parts.push(`- ${f.theme || f.insight || ''}: ${f.detail || ''}`)
        }
        if (obj.keyFindings?.length) {
          parts.push('\n**关键发现：**')
          for (const f of obj.keyFindings) parts.push(`- ${f.insight || ''}: ${f.evidence || ''}`)
        }
        if (obj.recommendations?.length) {
          parts.push('\n**建议：**')
          for (const r of obj.recommendations) parts.push(`- ${r}`)
        }
        if (obj.risks?.length) {
          parts.push('\n**风险：**')
          for (const r of obj.risks) parts.push(`- ${r}`)
        }
        if (obj.finalSolution) parts.push(`\n**最终方案：**\n${obj.finalSolution}`)
        return parts.join('\n') || raw
      }
    } catch {}
    return raw
  }

  function addSpeech(speech: Partial<RoundtableSpeech>) {
    const rawContent = String(speech.content || '')
    speeches.value.push({
      round: Number(speech.round ?? 1),
      agent: (speech.agent || 'research') as AgentRole,
      model: String(speech.model || ''),
      content: parseContent(rawContent),
      stance: speech.stance || 'propose',
    })
  }

  function setConsensus(value: RoundtableConsensus) {
    consensus.value = value
    isRunning.value = false
    phase.value = 'done'
  }

  function reset() {
    speeches.value = []
    consensus.value = null
    isRunning.value = false
    totalTokens.value = 0
    phase.value = 'idle'
    thinkingAgent.value = null
  }

  return { topic, agents, maxRounds, speeches, consensus, isRunning, activeRound, totalTokens, phase, thinkingAgent, startRoundtable, addSpeech, setConsensus, reset }
})
