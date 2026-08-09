import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AgentRole, AgentStatus, SubTask, TaskStatus } from '@hermes/shared'

export const useCompetitionDagStore = defineStore('competition-dag', () => {
  const tasks = ref<SubTask[]>([])
  const agentStatuses = ref<Record<string, AgentStatus>>({})
  const selectedTaskId = ref<string | null>(null)

  const completedCount = computed(() => tasks.value.filter(task => task.status === 'success').length)
  const runningCount = computed(() => tasks.value.filter(task => task.status === 'running').length)
  const overallProgress = computed(() => tasks.value.length ? Math.round(tasks.value.reduce((sum, task) => sum + (agentStatuses.value[task.agent]?.progress ?? (task.status === 'success' ? 100 : 0)), 0) / tasks.value.length) : 0)

  function setTaskPlan(next: unknown) {
    const raw = Array.isArray(next) ? next : (next && typeof next === 'object' && Array.isArray((next as any).tasks) ? (next as any).tasks : [])
    tasks.value = raw.map((task: any, index: number) => ({
      id: String(task.id || task.taskId || `task-${index + 1}`),
      title: String(task.title || task.objective || task.description || `Subtask ${index + 1}`),
      agent: String(task.agent || 'research') as AgentRole,
      dependsOn: Array.isArray(task.dependsOn) ? task.dependsOn.map(String) : [],
      status: (String(task.status || 'pending') as TaskStatus),
    }))
  }

  function updateAgentStatus(status: Partial<AgentStatus> & { agent: AgentRole }) {
    const previous = agentStatuses.value[status.agent]
    agentStatuses.value = {
      ...agentStatuses.value,
      [status.agent]: {
        taskId: String(status.taskId || previous?.taskId || tasks.value.find(task => task.agent === status.agent)?.id || ''),
        agent: status.agent,
        status: status.status || previous?.status || 'running',
        progress: Number(status.progress ?? previous?.progress ?? 0),
        model: String(status.model || previous?.model || ''),
      },
    }
    const task = tasks.value.find(item => item.id === agentStatuses.value[status.agent].taskId || item.agent === status.agent)
    if (task) task.status = agentStatuses.value[status.agent].status
  }

  function reset() {
    tasks.value = []
    agentStatuses.value = {}
    selectedTaskId.value = null
  }

  return { tasks, agentStatuses, selectedTaskId, completedCount, runningCount, overallProgress, setTaskPlan, updateAgentStatus, reset }
})
