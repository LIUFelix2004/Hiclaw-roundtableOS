import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface CompetitionStats {
  tokens: Record<string, number>
  costs: Record<string, number>
  latency: Record<string, number>
  successRate: number
  totalRuns: number
}

const emptyStats = (): CompetitionStats => ({ tokens: {}, costs: {}, latency: {}, successRate: 0, totalRuns: 0 })

export const useCompetitionDashboardStore = defineStore('competition-dashboard', () => {
  const stats = ref<CompetitionStats>(emptyStats())
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function loadStats() {
    isLoading.value = true
    error.value = null
    try {
      const response = await fetch('/api/competition/stats')
      if (!response.ok) throw new Error(`Stats request failed (${response.status})`)
      stats.value = { ...emptyStats(), ...(await response.json()) }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unable to load competition stats'
    } finally {
      isLoading.value = false
    }
  }

  return { stats, isLoading, error, loadStats }
})
