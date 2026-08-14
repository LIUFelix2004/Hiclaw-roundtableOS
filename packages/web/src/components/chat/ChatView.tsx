'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Bot, LoaderCircle } from 'lucide-react';
import type { AgentOutput, AgentStatus, RollbackCompleteEvent, RollbackEvent, RollbackResult, SubTask } from '@hermes/shared';
import { useSocket } from '@/hooks/useSocket';
import { toRollbackCompleteView, type RollbackCompleteView } from '@/lib/events';
import { MessageBubble } from './MessageBubble';
import { AgentStatusBar } from './AgentStatusBar';
import { RollbackNotice } from '@/components/rollback/RollbackNotice';

type ChatMessage = { id: string; type: 'user' | 'plan' | 'stream' | 'output' | 'error'; content?: string; tasks?: SubTask[]; taskId?: string; agent?: string; model?: string; streaming?: boolean };

export function ChatView() {
  const { emit, on, off } = useSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [statuses, setStatuses] = useState<AgentStatus[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [rollbackStarted, setRollbackStarted] = useState<RollbackEvent | null>(null);
  const [rollbackCompleted, setRollbackCompleted] = useState<RollbackCompleteView | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeStreams = useMemo(() => new Set(messages.filter((m) => m.type === 'stream' && m.streaming).map((m) => m.taskId)), [messages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    const plan = ({ tasks }: { tasks: SubTask[] }) => setMessages((current) => [...current, { id: `plan-${Date.now()}`, type: 'plan', tasks }]);
    const status = (event: AgentStatus) => setStatuses((current) => [...current.filter((item) => item.taskId !== event.taskId), event]);
    const stream = ({ taskId, agent, chunk }: { taskId: string; agent: string; chunk: string }) => setMessages((current) => { const existing = current.find((item) => item.type === 'stream' && item.taskId === taskId); if (existing) return current.map((item) => item === existing ? { ...item, content: `${item.content ?? ''}${chunk}`, streaming: true } : item); return [...current, { id: `stream-${taskId}`, type: 'stream', taskId, agent, content: chunk, streaming: true }]; });
    const output = (event: AgentOutput) => setMessages((current) => [...current.map((item) => item.taskId === event.taskId && item.type === 'stream' ? { ...item, streaming: false } : item), { id: `output-${event.taskId}-${Date.now()}`, type: 'output', taskId: event.taskId, agent: event.agent, content: event.content, model: `${event.tokens} tokens` }]);
    const error = ({ message }: { message: string }) => setMessages((current) => [...current, { id: `error-${Date.now()}`, type: 'error', content: message }]);
    const rollbackStart = (event: RollbackEvent) => { setRollbackStarted(event); setRollbackCompleted(null); };
    const rollbackComplete = (event: RollbackResult | RollbackCompleteEvent) => { setRollbackCompleted(toRollbackCompleteView(event)); setRollbackStarted(null); };
    on('task:plan', plan); on('agent:status', status); on('agent:stream', stream); on('agent:output', output); on('agent:error', error); on('task:error', error); on('error', error); on('rollback:start', rollbackStart); on('rollback:complete', rollbackComplete);
    return () => { off('task:plan', plan); off('agent:status', status); off('agent:stream', stream); off('agent:output', output); off('agent:error', error); off('task:error', error); off('error', error); off('rollback:start', rollbackStart); off('rollback:complete', rollbackComplete); };
  }, [on, off]);

  const submit = (event: FormEvent) => { event.preventDefault(); const message = input.trim(); if (!message || sending) return; setMessages((current) => [...current, { id: `user-${Date.now()}`, type: 'user', content: message }]); emit('task:create', { message }); setInput(''); setSending(true); window.setTimeout(() => setSending(false), 500); };

  return (
    <section className="flex min-h-full flex-col">
      {/* Header */}
      <header className="border-b px-6 py-4" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Hermes workspace</p>
          <h1 className="mt-0.5 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Dialogue Center</h1>
          <p className="mt-0.5 text-[13px]" style={{ color: 'var(--text-secondary)' }}>Stream task planning, agent reasoning, and final output in one place.</p>
        </div>
      </header>

      <RollbackNotice started={rollbackStarted} completed={rollbackCompleted} />
      <AgentStatusBar statuses={statuses} />

      {/* Messages */}
      <div className="flex flex-1 flex-col px-4 py-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4">
          {!messages.length ? (
            <div className="flex flex-1 items-center justify-center text-center">
              <div>
                <Bot className="mx-auto mb-3 h-10 w-10" style={{ color: 'var(--accent-muted)' }} />
                <p className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>Ready when you are</p>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Send a task to start multi-agent collaboration.</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 space-y-4">
              {messages.map((message) =>
                message.type === 'user' ? (
                  <MessageBubble key={message.id} role="user" content={message.content ?? ''} />
                ) : message.type === 'stream' || message.type === 'output' ? (
                  <MessageBubble key={message.id} role="agent" agent={message.agent} model={message.model} content={message.content ?? ''} streaming={message.streaming} />
                ) : message.type === 'plan' ? (
                  <div key={message.id} className="rounded-lg border p-4 text-sm" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
                    <p className="mb-2 font-medium" style={{ color: 'var(--text-primary)' }}>Task plan</p>
                    <ol className="list-decimal space-y-1 pl-5" style={{ color: 'var(--text-secondary)' }}>
                      {message.tasks?.map((task) => <li key={task.id}>{task.title} <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({task.agent})</span></li>)}
                    </ol>
                  </div>
                ) : (
                  <div key={message.id} role="alert" className="rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--error)', background: 'var(--bg-card)', color: 'var(--error)' }}>
                    {message.content}
                  </div>
                )
              )}
              {activeStreams.size > 0 && (
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Agents are streaming...
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}

          {/* Input */}
          <form onSubmit={submit} className="relative">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Describe the task you want the agents to solve..."
              rows={3}
              className="w-full resize-none rounded-lg border px-4 py-3 pr-14 text-sm outline-none focus:ring-1"
              style={{
                background: 'var(--bg-input)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
                borderRadius: 'var(--radius-md)',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
              aria-label="Task description"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-md disabled:opacity-30"
              style={{ background: 'var(--accent-primary)', color: 'var(--text-on-accent)', borderRadius: 'var(--radius-sm)' }}
              aria-label="Send task"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
