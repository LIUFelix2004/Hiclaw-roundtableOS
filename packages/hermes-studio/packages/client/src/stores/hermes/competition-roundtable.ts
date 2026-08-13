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
    socket.off('agent:output')

    socket.on('roundtable:speech', (data: Partial<RoundtableSpeech>) => {
      addSpeech(data)
      if (data.stance === 'synthesize') {
        phase.value = 'done'
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

    socket.emit('roundtable:start', { topic: config.topic, agents: config.agents, maxRounds: maxRounds.value })
  }

  function addSpeech(speech: Partial<RoundtableSpeech>) {
    speeches.value.push({
      round: Number(speech.round || 1),
      agent: (speech.agent || 'research') as AgentRole,
      model: String(speech.model || ''),
      content: String(speech.content || ''),
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
  }

  return { topic, agents, maxRounds, speeches, consensus, isRunning, activeRound, totalTokens, phase, startRoundtable, addSpeech, setConsensus, reset }
})
