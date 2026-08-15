'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Bot, LoaderCircle } from 'lucide-react';
import type { AgentOutput, AgentStatus, RollbackCompleteEvent, RollbackEvent, RollbackResult, SubTask, ValidatorResult } from '@hermes/shared';
import { useSocket } from '@/hooks/useSocket';
import { toRollbackCompleteView, type RollbackCompleteView } from '@/lib/events';
import { BACKEND_MODE, BACKEND_URL } from '@/lib/socket';
import { MessageBubble } from './MessageBubble';
import { AgentStatusBar } from './AgentStatusBar';
import { RollbackNotice } from '@/components/rollback/RollbackNotice';
import { ValidatorCard } from './ValidatorCard';

type ChatMessage = {
  id: string;
  type: 'user' | 'plan' | 'stream' | 'output' | 'error' | 'system';
  content?: string;
  tasks?: SubTask[];
  taskId?: string;
  agent?: string;
  model?: string;
  streaming?: boolean;
  source?: 'llm' | 'rules';
  reasoning?: string;
};

const STREAM_FLUSH_INTERVAL_MS = 100;
const SCROLL_BOTTOM_THRESHOLD_PX = 80;

function findScrollContainer(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const { overflowY } = window.getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') return node;
    node = node.parentElement;
  }
  return null;
}

export function ChatView() {
  const { emit, on, off, socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [statuses, setStatuses] = useState<AgentStatus[]>([]);
  const [validators, setValidators] = useState<Record<string, ValidatorResult>>({});
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [rollbackStarted, setRollbackStarted] = useState<RollbackEvent | null>(null);
  const [rollbackCompleted, setRollbackCompleted] = useState<RollbackCompleteView | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeStreams = useMemo(() => new Set(messages.filter((m) => m.type === 'stream' && m.streaming).map((m) => m.taskId)), [messages]);

  // 流式节流缓冲：chunk 先累积，100ms 合并一次 setMessages，避免 ReactMarkdown 高频全量重解析
  const pendingStreamsRef = useRef<Map<string, { agent: string; text: string }>>(new Map());
  const streamFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 智能滚动：仅当已处于底部附近（<80px）才跟随，避免用户上滑看历史被拽回底部
  useEffect(() => {
    const container = findScrollContainer(bottomRef.current);
    if (container) {
      const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < SCROLL_BOTTOM_THRESHOLD_PX;
      if (!nearBottom) return;
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  useEffect(() => {
    const flushPendingStreams = () => {
      const pending = pendingStreamsRef.current;
      if (pending.size === 0) return;
      const chunks = Array.from(pending.entries());
      pending.clear();
      if (streamFlushTimerRef.current) {
        clearTimeout(streamFlushTimerRef.current);
        streamFlushTimerRef.current = null;
      }
      setMessages((current) => {
        let next = current;
        for (const [taskId, { agent, text }] of chunks) {
          const existing = next.find((item) => item.type === 'stream' && item.taskId === taskId);
          if (existing) {
            next = next.map((item) => (item === existing ? { ...item, content: `${item.content ?? ''}${text}`, streaming: true } : item));
          } else {
            next = [...next, { id: `stream-${taskId}`, type: 'stream', taskId, agent, content: text, streaming: true }];
          }
        }
        return next;
      });
    };

    const plan = ({ tasks, source, reasoning }: { tasks: SubTask[]; source?: 'llm' | 'rules'; reasoning?: string }) =>
      setMessages((current) => [...current, { id: `plan-${Date.now()}`, type: 'plan', tasks, source, reasoning }]);
    const status = (event: AgentStatus) => setStatuses((current) => [...current.filter((item) => item.taskId !== event.taskId), event]);
    const stream = ({ taskId, agent, chunk }: { taskId: string; agent: string; chunk: string }) => {
      const pending = pendingStreamsRef.current;
      const cur = pending.get(taskId) ?? { agent, text: '' };
      cur.text += chunk;
      pending.set(taskId, cur);
      if (!streamFlushTimerRef.current) {
        streamFlushTimerRef.current = setTimeout(flushPendingStreams, STREAM_FLUSH_INTERVAL_MS);
      }
    };
    const output = (event: AgentOutput) => {
      flushPendingStreams();
      setMessages((current) => [
        ...current.map((item) => (item.taskId === event.taskId && item.type === 'stream' ? { ...item, streaming: false } : item)),
        { id: `output-${event.taskId}-${Date.now()}`, type: 'output', taskId: event.taskId, agent: event.agent, content: event.content, model: `${event.tokens} tokens` },
      ]);
    };
    const error = ({ message }: { message: string }) => setMessages((current) => [...current, { id: `error-${Date.now()}`, type: 'error', content: message }]);
    const validatorResult = (event: ValidatorResult) => setValidators((current) => ({ ...current, [event.taskId]: event }));
    const rollbackStart = (event: RollbackEvent) => { setRollbackStarted(event); setRollbackCompleted(null); };
    const rollbackComplete = (event: RollbackResult | RollbackCompleteEvent) => { setRollbackCompleted(toRollbackCompleteView(event)); setRollbackStarted(null); };

    on('task:plan', plan);
    on('agent:status', status);
    on('agent:stream', stream);
    on('agent:output', output);
    on('agent:error', error);
    on('task:error', error);
    on('error', error);
    on('validator:result', validatorResult);
    on('rollback:start', rollbackStart);
    on('rollback:complete', rollbackComplete);

    // bridge:echo 不在 shared 契约内，经 socket 实例直接订阅，作为系统提示渲染
    const bridgeEcho = (data: { message: string }) =>
      setMessages((current) => [...current, { id: `sys-${Date.now()}`, type: 'system', content: data.message }]);
    socket?.on('bridge:echo' as never, bridgeEcho as never);

    return () => {
      off('task:plan', plan);
      off('agent:status', status);
      off('agent:stream', stream);
      off('agent:output', output);
      off('agent:error', error);
      off('task:error', error);
      off('error', error);
      off('validator:result', validatorResult);
      off('rollback:start', rollbackStart);
      off('rollback:complete', rollbackComplete);
      socket?.off('bridge:echo' as never, bridgeEcho as never);
      if (streamFlushTimerRef.current) clearTimeout(streamFlushTimerRef.current);
    };
  }, [on, off, socket]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || sending || !isConnected) return;
    setMessages((current) => [...current, { id: `user-${Date.now()}`, type: 'user', content: message }]);
    emit('task:create', { message });
    setInput('');
    setSending(true);
    window.setTimeout(() => setSending(false), 500);
  };

  const backendPort = (() => { try { return new URL(BACKEND_URL).port; } catch { return ''; } })();

  return (
    <section className="flex min-h-full flex-col">
      {/* Header */}
      <header className="border-b px-6 py-4" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Hermes workspace</p>
            <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
              {BACKEND_MODE}{backendPort ? ` · :${backendPort}` : ''}
            </span>
          </div>
          <h1 className="mt-0.5 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Dialogue Center</h1>
          <p className="mt-0.5 text-[13px]" style={{ color: 'var(--text-secondary)' }}>Stream task planning, agent reasoning, and final output in one place.</p>
        </div>
      </header>

      <RollbackNotice started={rollbackStarted} completed={rollbackCompleted} />
      <AgentStatusBar statuses={statuses} />

      {/* Messages */}
      <div className="flex flex-1 flex-col px-4 py-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4">
          {!isConnected && messages.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
              <LoaderCircle className="h-4 w-4 animate-spin" /> 连接已断开，正在重连…
            </div>
          )}

          {!messages.length ? (
            <div className="flex flex-1 items-center justify-center text-center">
              <div>
                <Bot className="mx-auto mb-3 h-10 w-10" style={{ color: 'var(--accent-muted)' }} />
                <p className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                  {isConnected ? 'Ready when you are' : `正在连接 ${BACKEND_MODE} 后端…`}
                </p>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                  {isConnected ? 'Send a task to start multi-agent collaboration.' : '连接建立后可发送任务'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 space-y-4">
              {messages.map((message) => {
                if (message.type === 'user') {
                  return <MessageBubble key={message.id} role="user" content={message.content ?? ''} />;
                }
                if (message.type === 'stream' || message.type === 'output') {
                  const result = message.type === 'output' && message.taskId ? validators[message.taskId] : undefined;
                  return (
                    <div key={message.id} className="space-y-2">
                      <MessageBubble role="agent" agent={message.agent} model={message.model} content={message.content ?? ''} streaming={message.streaming} />
                      {result ? <ValidatorCard result={result} /> : null}
                    </div>
                  );
                }
                if (message.type === 'plan') {
                  return (
                    <div key={message.id} className="rounded-lg border p-4 text-sm" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
                      <div className="mb-2 flex items-center gap-2">
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Task plan</p>
                        {message.source ? (
                          <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                            {message.source === 'llm' ? 'LLM 规划' : '规则拆解'}
                          </span>
                        ) : null}
                      </div>
                      <ol className="list-decimal space-y-1 pl-5" style={{ color: 'var(--text-secondary)' }}>
                        {message.tasks?.map((task) => <li key={task.id}>{task.title} <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({task.agent})</span></li>)}
                      </ol>
                      {message.reasoning ? (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs" style={{ color: 'var(--text-muted)' }}>规划依据</summary>
                          <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{message.reasoning}</p>
                        </details>
                      ) : null}
                    </div>
                  );
                }
                if (message.type === 'system') {
                  return (
                    <div key={message.id} className="rounded-lg border px-3 py-2 text-center text-xs" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                      {message.content}
                    </div>
                  );
                }
                return (
                  <div key={message.id} role="alert" className="rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--error)', background: 'var(--bg-card)', color: 'var(--error)' }}>
                    {message.content}
                  </div>
                );
              })}
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
              placeholder={isConnected ? "Describe the task you want the agents to solve..." : '等待连接后端…'}
              rows={3}
              disabled={!isConnected}
              className="w-full resize-none rounded-lg border px-4 py-3 pr-14 text-sm outline-none focus:ring-1 disabled:opacity-50"
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
              disabled={!input.trim() || sending || !isConnected}
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
