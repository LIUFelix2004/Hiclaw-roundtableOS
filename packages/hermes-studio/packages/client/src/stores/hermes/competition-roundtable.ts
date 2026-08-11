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
  const activeRound = computed(() => speeches.value.length ? Math.max(...speeches.value.map(speech => speech.round)) : 0)

  function emit(event: string, payload: unknown) {
    const socket = getChatRunSocket('chat-run') || connectChatRun(null, 'chat-run')
    socket.emit(event, payload)
  }

  function startRoundtable(config: RoundtableConfig) {
    topic.value = config.topic
    agents.value = config.agents
    maxRounds.value = config.maxRounds || 3
    speeches.value = []
    consensus.value = null
    isRunning.value = true
    emit('roundtable:start', { topic: config.topic, agents: config.agents, maxRounds: maxRounds.value })
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
  }

  function reset() {
    speeches.value = []
    consensus.value = null
    isRunning.value = false
  }

  return { topic, agents, maxRounds, speeches, consensus, isRunning, activeRound, startRoundtable, addSpeech, setConsensus, reset }
})
