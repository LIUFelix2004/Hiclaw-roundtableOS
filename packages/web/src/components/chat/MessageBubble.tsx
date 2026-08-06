'use client';

import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';
import remarkGfm from 'remark-gfm';
import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/cn';

export type MessageBubbleProps = { role: 'user' | 'agent'; content: string; agent?: string; model?: string; streaming?: boolean };

export function MessageBubble({ role, content, agent, model, streaming = false }: MessageBubbleProps) {
  const isUser = role === 'user';
  return <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
    {!isUser && <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><Bot className="h-4 w-4" /></span>}
    <div className={cn('max-w-[min(48rem,88%)]', isUser ? 'items-end' : 'items-start')}>
      {!isUser && <div className="mb-1 flex items-center gap-2 text-xs text-zinc-500"><span className="font-medium text-zinc-700 dark:text-zinc-300">{agent ?? 'Agent'}</span>{model && <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">{model}</span>}</div>}
      <div className={cn('rounded-2xl px-4 py-3 text-sm leading-6', isUser ? 'bg-blue-600 text-white' : 'bg-white text-zinc-800 shadow-sm dark:bg-zinc-900 dark:text-zinc-200')}>
        {isUser ? <div className="flex items-start gap-2"><User className="mt-1 h-3.5 w-3.5 shrink-0" /><span>{content}</span></div> : <div className="prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>{streaming && <span className="stream-cursor" aria-label="Streaming" />}</div>}
      </div>
    </div>
  </motion.div>;
}
