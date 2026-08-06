'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Bot, LoaderCircle } from 'lucide-react';
import type { AgentOutput, AgentStatus, RollbackCompleteEvent, RollbackEvent, SubTask } from '@hermes/shared';
import { useSocket } from '@/hooks/useSocket';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
  const [rollbackCompleted, setRollbackCompleted] = useState<RollbackCompleteEvent | null>(null);
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
    const rollbackComplete = (event: RollbackCompleteEvent) => { setRollbackCompleted(event); setRollbackStarted(null); };
    on('task:plan', plan); on('agent:status', status); on('agent:stream', stream); on('agent:output', output); on('agent:error', error); on('error', error); on('rollback:start', rollbackStart); on('rollback:complete', rollbackComplete);
    return () => { off('task:plan', plan); off('agent:status', status); off('agent:stream', stream); off('agent:output', output); off('agent:error', error); off('error', error); off('rollback:start', rollbackStart); off('rollback:complete', rollbackComplete); };
  }, [on, off]);

  const submit = (event: FormEvent) => { event.preventDefault(); const message = input.trim(); if (!message || sending) return; setMessages((current) => [...current, { id: `user-${Date.now()}`, type: 'user', content: message }]); emit('task:create', { message }); setInput(''); setSending(true); window.setTimeout(() => setSending(false), 500); };
  return <section className="flex min-h-full flex-col"><header className="border-b border-zinc-200 bg-white px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950"><div className="mx-auto max-w-5xl"><p className="text-xs font-medium uppercase tracking-wider text-blue-600">Hermes workspace</p><h1 className="mt-1 text-xl font-semibold tracking-tight">Dialogue Center</h1><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Stream task planning, agent reasoning, and final output in one place.</p></div></header><RollbackNotice started={rollbackStarted} completed={rollbackCompleted} /><AgentStatusBar statuses={statuses} /><div className="flex flex-1 flex-col px-4 py-6 sm:px-6"><div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5">{!messages.length ? <div className="flex flex-1 items-center justify-center text-center text-zinc-500"><div><Bot className="mx-auto mb-3 h-10 w-10 text-blue-500" /><p className="text-lg font-medium text-zinc-800 dark:text-zinc-200">Ready when you are</p><p className="mt-1 text-sm">Send a task to start multi-agent collaboration.</p></div></div> : <div className="flex-1 space-y-5">{messages.map((message) => message.type === 'user' ? <MessageBubble key={message.id} role="user" content={message.content ?? ''} /> : message.type === 'stream' || message.type === 'output' ? <MessageBubble key={message.id} role="agent" agent={message.agent} model={message.model} content={message.content ?? ''} streaming={message.streaming} /> : message.type === 'plan' ? <div key={message.id} className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-900 dark:bg-blue-950/30"><p className="mb-2 font-medium text-blue-800 dark:text-blue-200">Task plan</p><ol className="list-decimal space-y-1 pl-5 text-blue-900/80 dark:text-blue-100/80">{message.tasks?.map((task) => <li key={task.id}>{task.title} <span className="text-xs">({task.agent})</span></li>)}</ol></div> : <div key={message.id} role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{message.content}</div>)}{activeStreams.size > 0 && <div className="flex items-center gap-2 text-sm text-zinc-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Agents are streaming...</div>}<div ref={bottomRef} /></div>}<form onSubmit={submit} className="relative"><Textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Describe the task you want the agents to solve..." rows={3} className="resize-none bg-white pr-14 dark:bg-zinc-900" aria-label="Task description" /><Button type="submit" size="icon" disabled={!input.trim() || sending} className="absolute bottom-3 right-3" aria-label="Send task"><ArrowUp className="h-4 w-4" /></Button></form></div></div></section>;
}
