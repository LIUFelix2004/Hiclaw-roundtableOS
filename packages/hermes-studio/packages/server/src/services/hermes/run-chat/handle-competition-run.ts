/**
 * Competition bridge handler — forwards /chat-run `run` events
 * to B's backend (port 8648) and translates events back to
 * hermes-studio's event protocol.
 *
 * B's backend uses default Socket.IO namespace with:
 *   Client → Server: task:create { message }
 *   Server → Client: task:plan, agent:status, agent:stream,
 *                    agent:output, agent:trace, agent:snapshot,
 *                    agent:error, validator:result,
 *                    rollback:start/complete/human,
 *                    roundtable:speech/consensus,
 *                    memory:updated, error
 *
 * hermes-studio frontend expects /chat-run namespace with:
 *   run.started, message.delta, agent.event, run.completed, run.failed
 */

import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client'
import type { Socket } from 'socket.io'
import { randomUUID } from 'crypto'
import { logger } from '../../logger'
import { createSession, addMessage, getSession, updateSession } from '../../../db/hermes/session-store'
import { contentBlocksToString } from './content-blocks'
import type { ContentBlock, SessionState } from './types'

const BACKEND_URL = process.env.HERMES_COMPETITION_BACKEND_URL || 'http://127.0.0.1:8648'

function formatAgentOutput(agent: string, data: any): string {
  const parts: string[] = []
  parts.push(`\n### ${agent.charAt(0).toUpperCase() + agent.slice(1)} Agent\n`)

  if (data.summary) {
    parts.push(`${data.summary}\n`)
  }

  if (data.findings?.length) {
    parts.push('\n**Key Findings:**\n')
    for (const f of data.findings) {
      parts.push(`- **${f.theme || f.insight}**: ${f.detail || f.evidence || ''} (confidence: ${(f.confidence * 100).toFixed(0)}%)\n`)
    }
  }

  if (data.keyFindings?.length) {
    parts.push('\n**Key Findings:**\n')
    for (const f of data.keyFindings) {
      parts.push(`- **${f.insight}** — ${f.evidence || ''} (confidence: ${(f.confidence * 100).toFixed(0)}%)\n`)
    }
  }

  if (data.recommendations?.length) {
    parts.push('\n**Recommendations:**\n')
    for (const r of data.recommendations) {
      parts.push(`- ${r}\n`)
    }
  }

  if (data.risks?.length) {
    parts.push('\n**Risks:**\n')
    for (const r of data.risks) {
      parts.push(`- ${r}\n`)
    }
  }

  if (data.metrics) {
    parts.push('\n**Metrics:** ')
    parts.push(Object.entries(data.metrics).map(([k, v]) => `${k}=${v}`).join(', '))
    parts.push('\n')
  }

  if (data.confidence != null) {
    parts.push(`\n*Overall confidence: ${(data.confidence * 100).toFixed(0)}%*\n`)
  }

  parts.push('\n---\n\n')
  return parts.join('')
}

interface CompetitionRunData {
  input: string | ContentBlock[]
  session_id?: string
  profile?: string
  queue_id?: string
  category_id?: number | null
}

export function isCompetitionMode(): boolean {
  const flag = (process.env.HERMES_COMPETITION_MODE || '').trim().toLowerCase()
  const result = ['1', 'true', 'yes', 'on'].includes(flag)
  console.log(`[competition-bridge] isCompetitionMode check: HERMES_COMPETITION_MODE="${process.env.HERMES_COMPETITION_MODE}" → ${result}`)
  return result
}

export async function handleCompetitionRun(
  socket: Socket,
  data: CompetitionRunData,
  sessionMap: Map<string, SessionState>,
  emitToSession: (socket: Socket, sessionId: string, event: string, payload: any) => void,
) {
  const sessionId = data.session_id || randomUUID()
  const runId = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const inputText = typeof data.input === 'string'
    ? data.input
    : contentBlocksToString(data.input)

  // Ensure session exists in DB
  if (!getSession(sessionId)) {
    createSession({
      id: sessionId,
      profile: data.profile || 'default',
    })
    updateSession(sessionId, { title: inputText.slice(0, 80) || 'New Chat' })
  }

  // Persist user message
  addMessage({
    session_id: sessionId,
    role: 'user',
    content: inputText,
    timestamp: Date.now(),
  })

  // Update session state
  const state = sessionMap.get(sessionId) || {
    messages: [],
    events: [],
    isWorking: true,
    queue: [],
  }
  state.isWorking = true
  state.runId = runId
  sessionMap.set(sessionId, state as SessionState)

  // Join session room for broadcasting
  socket.join(`session:${sessionId}`)

  // Emit run.started
  emitToSession(socket, sessionId, 'run.started', {
    event: 'run.started',
    session_id: sessionId,
    run_id: runId,
  })

  // Connect to B's backend
  const backendSocket: ClientSocket = ioClient(BACKEND_URL, {
    transports: ['websocket', 'polling'],
    reconnection: false,
    timeout: 30000,
  })

  let outputParts: string[] = []
  let finished = false

  const cleanup = () => {
    if (finished) return
    finished = true
    backendSocket.removeAllListeners()
    backendSocket.disconnect()
    state.isWorking = false
    state.runId = undefined
  }

  const finishSuccess = (finalOutput: string) => {
    if (finished) return
    // Persist assistant message
    addMessage({
      session_id: sessionId,
      role: 'assistant',
      content: finalOutput,
      timestamp: Date.now(),
    })
    emitToSession(socket, sessionId, 'run.completed', {
      event: 'run.completed',
      session_id: sessionId,
      run_id: runId,
      output: finalOutput,
    })
    cleanup()
  }

  const finishError = (error: string) => {
    if (finished) return
    emitToSession(socket, sessionId, 'run.failed', {
      event: 'run.failed',
      session_id: sessionId,
      run_id: runId,
      error,
    })
    cleanup()
  }

  // Timeout
  const timer = setTimeout(() => {
    finishError('Backend request timed out after 5 minutes')
  }, 300_000)

  backendSocket.on('connect_error', (err) => {
    clearTimeout(timer)
    logger.error('[competition-bridge] connect error: %s', err.message)
    finishError(`Cannot reach competition backend: ${err.message}`)
  })

  backendSocket.on('connect', () => {
    logger.info('[competition-bridge] connected to %s, sending task:create', BACKEND_URL)
    backendSocket.emit('task:create', { message: inputText })
  })

  // task:plan — emit as agent.event so the sidebar shows subtask breakdown
  backendSocket.on('task:plan', (payload: { tasks: any[] }) => {
    if (finished) return
    const planText = payload.tasks
      .map((t: any) => `- **${t.agent}**: ${t.title} (${t.status})`)
      .join('\n')
    emitToSession(socket, sessionId, 'agent.event', {
      event: 'agent.event',
      session_id: sessionId,
      run_id: runId,
      name: 'task_plan',
      preview: `Planning ${payload.tasks.length} subtasks`,
      data: payload,
    })
    // Also send as message delta so user sees it
    emitToSession(socket, sessionId, 'message.delta', {
      event: 'message.delta',
      session_id: sessionId,
      run_id: runId,
      delta: `**Task Plan:**\n${planText}\n\n---\n\n`,
    })
    outputParts.push(`**Task Plan:**\n${planText}\n\n---\n\n`)
  })

  // agent:status — show as agent.event
  backendSocket.on('agent:status', (payload: any) => {
    if (finished) return
    emitToSession(socket, sessionId, 'agent.event', {
      event: 'agent.event',
      session_id: sessionId,
      run_id: runId,
      name: `agent_${payload.agent}_${payload.status}`,
      preview: `[${payload.agent}] ${payload.status} (${payload.progress}%)`,
      data: payload,
    })
  })

  // agent:stream — only show status indicator, don't dump raw JSON chunks
  backendSocket.on('agent:stream', (payload: { taskId: string; agent: string; chunk: string }) => {
    if (finished) return
    // Emit agent event to show the agent is working (no raw content)
    emitToSession(socket, sessionId, 'agent.event', {
      event: 'agent.event',
      session_id: sessionId,
      run_id: runId,
      name: `agent_${payload.agent}_streaming`,
      preview: `${payload.agent} is generating...`,
    })
  })

  // agent:output — the final output from an agent, format nicely
  backendSocket.on('agent:output', (payload: any) => {
    if (finished) return
    const rawContent = payload.content || ''
    const agent = payload.agent || 'unknown'

    // Format the content for display
    let formatted = rawContent
    try {
      const parsed = JSON.parse(rawContent)
      if (parsed && typeof parsed === 'object') {
        formatted = formatAgentOutput(agent, parsed)
      }
    } catch {
      // Not JSON — use as-is (e.g. the "## Task Complete" summary)
    }

    const meta = [
      payload.tokens ? `${payload.tokens} tokens` : '',
      payload.duration ? `${(payload.duration / 1000).toFixed(1)}s` : '',
      payload.cost ? `$${payload.cost.toFixed(4)}` : '',
    ].filter(Boolean).join(' · ')

    const block = meta ? `${formatted}\n> *${meta}*\n\n` : formatted

    emitToSession(socket, sessionId, 'message.delta', {
      event: 'message.delta',
      session_id: sessionId,
      run_id: runId,
      delta: block,
    })
    outputParts.push(block)

    // If this is the final summary, complete the run
    if (rawContent.includes('## Task Complete') || agent === 'writer') {
      clearTimeout(timer)
      finishSuccess(outputParts.join(''))
    }
  })

  // agent:trace — emit as agent.event
  backendSocket.on('agent:trace', (payload: any) => {
    if (finished) return
    emitToSession(socket, sessionId, 'agent.event', {
      event: 'agent.event',
      session_id: sessionId,
      run_id: runId,
      name: 'agent_trace',
      preview: payload.phase || payload.name || 'trace',
      data: payload,
    })
  })

  // validator:result
  backendSocket.on('validator:result', (payload: any) => {
    if (finished) return
    const statusEmoji = payload.pass ? '✅' : '❌'
    const validationText = `\n\n**Validation ${statusEmoji}**: accuracy=${payload.scores?.accuracy}, completeness=${payload.scores?.completeness}, safety=${payload.scores?.safety}\n\n`
    emitToSession(socket, sessionId, 'message.delta', {
      event: 'message.delta',
      session_id: sessionId,
      run_id: runId,
      delta: validationText,
    })
    outputParts.push(validationText)
  })

  // rollback events
  backendSocket.on('rollback:start', (payload: any) => {
    if (finished) return
    emitToSession(socket, sessionId, 'agent.event', {
      event: 'agent.event',
      session_id: sessionId,
      run_id: runId,
      name: 'rollback_start',
      preview: `Rollback: ${payload.fromModel} → ${payload.toModel}`,
      data: payload,
    })
  })

  backendSocket.on('rollback:complete', (payload: any) => {
    if (finished) return
    emitToSession(socket, sessionId, 'agent.event', {
      event: 'agent.event',
      session_id: sessionId,
      run_id: runId,
      name: 'rollback_complete',
      preview: `Rollback ${payload.recovered ? 'succeeded' : 'failed'}`,
      data: payload,
    })
  })

  // roundtable events
  backendSocket.on('roundtable:speech', (payload: any) => {
    if (finished) return
    const speechText = `**[Round ${payload.round}] ${payload.agent}** (${payload.stance}):\n${payload.content}\n\n`
    emitToSession(socket, sessionId, 'message.delta', {
      event: 'message.delta',
      session_id: sessionId,
      run_id: runId,
      delta: speechText,
    })
    outputParts.push(speechText)
  })

  backendSocket.on('roundtable:consensus', (payload: any) => {
    if (finished) return
    const consensusText = `\n**Consensus (${payload.rounds} rounds):**\n${payload.finalAnswer || payload.finalSolution || ''}\n\n`
    emitToSession(socket, sessionId, 'message.delta', {
      event: 'message.delta',
      session_id: sessionId,
      run_id: runId,
      delta: consensusText,
    })
    outputParts.push(consensusText)
    clearTimeout(timer)
    finishSuccess(outputParts.join(''))
  })

  // error
  backendSocket.on('error', (payload: { message: string }) => {
    if (finished) return
    clearTimeout(timer)
    finishError(payload.message)
  })

  // Handle socket disconnect
  backendSocket.on('disconnect', (reason) => {
    if (finished) return
    clearTimeout(timer)
    if (outputParts.length > 0) {
      finishSuccess(outputParts.join(''))
    } else {
      finishError(`Backend disconnected: ${reason}`)
    }
  })
}
