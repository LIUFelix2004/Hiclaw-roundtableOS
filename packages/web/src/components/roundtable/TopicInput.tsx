'use client';

import { FormEvent, useState } from 'react';
import { LoaderCircle, Play } from 'lucide-react';
import type { AgentRole, RoundtableConfig } from '@hermes/shared';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const agents: { id: AgentRole; label: string }[] = [{ id: 'data', label: 'Data' }, { id: 'research', label: 'Research' }, { id: 'analyst', label: 'Analyst' }, { id: 'writer', label: 'Writer' }];

export function TopicInput({ isRunning, onStart }: { isRunning: boolean; onStart: (config: RoundtableConfig) => void }) {
  const [topic, setTopic] = useState('');
  const [selected, setSelected] = useState<AgentRole[]>(['research', 'analyst', 'writer']);
  const [rounds, setRounds] = useState(2);
  const submit = (event: FormEvent) => { event.preventDefault(); if (topic.trim() && selected.length) onStart({ topic: topic.trim(), agents: selected, maxRounds: rounds }); };
  const toggle = (agent: AgentRole) => setSelected((current) => current.includes(agent) ? current.filter((item) => item !== agent) : [...current, agent]);
  return <form onSubmit={submit} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><div><label htmlFor="roundtable-topic" className="text-sm font-semibold">Discussion topic</label><Textarea id="roundtable-topic" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="What should the agent panel investigate?" rows={3} className="mt-2 bg-transparent" /></div><div className="flex flex-wrap items-end justify-between gap-4"><fieldset><legend className="mb-2 text-xs font-medium text-zinc-500">Agents</legend><div className="flex flex-wrap gap-2">{agents.map((agent) => <label key={agent.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 px-2.5 py-2 text-xs dark:border-zinc-700"><input type="checkbox" checked={selected.includes(agent.id)} onChange={() => toggle(agent.id)} className="accent-blue-600" />{agent.label}</label>)}</div></fieldset><label className="text-xs text-zinc-500">Max rounds<select value={rounds} onChange={(event) => setRounds(Number(event.target.value))} className="ml-2 h-9 rounded-md border border-zinc-200 bg-transparent px-2 text-sm text-zinc-800 outline-none dark:border-zinc-700 dark:text-zinc-200"><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></label><Button type="submit" disabled={isRunning || !topic.trim() || !selected.length}>{isRunning ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Running</> : <><Play className="h-4 w-4" /> Start roundtable</>}</Button></div></form>;
}
