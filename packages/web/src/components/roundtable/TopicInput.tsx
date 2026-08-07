'use client';

import { FormEvent, useState } from 'react';
import { LoaderCircle, Play } from 'lucide-react';
import type { AgentRole, RoundtableConfig } from '@hermes/shared';

const agents: { id: AgentRole; label: string }[] = [{ id: 'data', label: 'Data' }, { id: 'research', label: 'Research' }, { id: 'analyst', label: 'Analyst' }, { id: 'writer', label: 'Writer' }];

export function TopicInput({ isRunning, onStart }: { isRunning: boolean; onStart: (config: RoundtableConfig) => void }) {
  const [topic, setTopic] = useState('');
  const [selected, setSelected] = useState<AgentRole[]>(['research', 'analyst', 'writer']);
  const [rounds, setRounds] = useState(2);
  const submit = (event: FormEvent) => { event.preventDefault(); if (topic.trim() && selected.length) onStart({ topic: topic.trim(), agents: selected, maxRounds: rounds }); };
  const toggle = (agent: AgentRole) => setSelected((current) => current.includes(agent) ? current.filter((item) => item !== agent) : [...current, agent]);

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: 'var(--radius-md)' }}>
      <div>
        <label htmlFor="roundtable-topic" className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Discussion topic</label>
        <textarea
          id="roundtable-topic"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="What should the agent panel investigate?"
          rows={3}
          className="mt-2 w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)' }}
        />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <fieldset>
          <legend className="mb-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Agents</legend>
          <div className="flex flex-wrap gap-2">
            {agents.map((agent) => (
              <label key={agent.id} className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                <input type="checkbox" checked={selected.includes(agent.id)} onChange={() => toggle(agent.id)} className="accent-current" style={{ accentColor: 'var(--accent-primary)' }} />
                {agent.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Max rounds
          <select
            value={rounds}
            onChange={(event) => setRounds(Number(event.target.value))}
            className="ml-2 h-9 rounded-md border px-2 text-sm outline-none"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
          >
            <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={isRunning || !topic.trim() || !selected.length}
          className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-40"
          style={{ background: 'var(--accent-primary)', color: 'var(--text-on-accent)', borderRadius: 'var(--radius-sm)' }}
        >
          {isRunning ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Running</> : <><Play className="h-4 w-4" /> Start roundtable</>}
        </button>
      </div>
    </form>
  );
}
