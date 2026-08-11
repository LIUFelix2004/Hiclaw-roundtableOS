'use client';

import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';
import remarkGfm from 'remark-gfm';
import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/cn';

export type MessageBubbleProps = { role: 'user' | 'agent'; content: string; agent?: string; model?: string; streaming?: boolean };

export function MessageBubble({ role, content, agent, model, streaming = false }: MessageBubbleProps) {
  const isUser = role === 'user';
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
          <Bot className="h-4 w-4" />
        </span>
      )}
      <div className={cn('max-w-[min(48rem,88%)]', isUser ? 'items-end' : 'items-start')}>
        {!isUser && (
          <div className="mb-1 flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{agent ?? 'Agent'}</span>
            {model && <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>{model}</span>}
          </div>
        )}
        <div
          className="rounded-lg px-4 py-3 text-sm leading-6"
          style={{
            background: isUser ? 'var(--accent-primary)' : 'var(--msg-assistant-bg)',
            color: isUser ? 'var(--text-on-accent)' : 'var(--text-primary)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {isUser
            ? <div className="flex items-start gap-2"><User className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" /><span>{content}</span></div>
            : <div className="prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>{streaming && <span className="stream-cursor" aria-label="Streaming" />}</div>
          }
        </div>
      </div>
    </motion.div>
  );
}
