'use client';

import { useState } from 'react';

type ViewMode = 'chat' | 'canvas' | 'roundtable' | 'dashboard';

export default function Home() {
  const [view, setView] = useState<ViewMode>('chat');

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Sidebar */}
      <aside className="w-56 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h1 className="text-lg font-semibold tracking-tight">Hermes AgentOS</h1>
          <p className="text-xs text-zinc-500 mt-1">Multi-Agent Infrastructure</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {([
            { key: 'chat', label: 'Dialogue', icon: '💬' },
            { key: 'canvas', label: 'DAG Canvas', icon: '🔀' },
            { key: 'roundtable', label: 'AI Roundtable', icon: '🪑' },
            { key: 'dashboard', label: 'Dashboard', icon: '📊' },
          ] as const).map((item) => (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                view === item.key
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-medium'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-xs text-zinc-500">Server connected</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        {view === 'chat' && <ChatView />}
        {view === 'canvas' && <PlaceholderView title="DAG Canvas" description="Task orchestration visualization — coming soon" />}
        {view === 'roundtable' && <PlaceholderView title="AI Roundtable" description="Multi-agent debate interface — coming soon" />}
        {view === 'dashboard' && <PlaceholderView title="Dashboard" description="System metrics and monitoring — coming soon" />}
      </main>
    </div>
  );
}

function ChatView() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'agent'; content: string }[]>([]);

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { role: 'user', content: input }]);
    setMessages((prev) => [...prev, { role: 'agent', content: `[Planner] Received task: "${input}". Backend not connected yet — B will implement the Agent logic!` }]);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-3">
        <h2 className="font-semibold">Dialogue Center</h2>
        <p className="text-xs text-zinc-500">Natural language task input → Multi-agent execution</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center text-zinc-400">
              <p className="text-lg mb-2">Welcome to Hermes AgentOS</p>
              <p className="text-sm">Enter a task to start multi-agent collaboration</p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-lg rounded-2xl px-4 py-2.5 text-sm ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-800 p-4">
        <div className="flex gap-3 max-w-3xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Describe your task... e.g. Generate a new energy strategy report"
            className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleSend}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function PlaceholderView({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center text-zinc-400">
        <p className="text-xl mb-2">{title}</p>
        <p className="text-sm">{description}</p>
      </div>
    </div>
  );
}
