'use client';

import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { RoundtableSpeech } from '@hermes/shared';

export function SpeechCard({ speech }: { speech: RoundtableSpeech }) {
  // 防御性降级：live 链路若缺字段，显示占位而不是渲染崩溃
  const agent = speech.agent ?? 'agent';
  const content = typeof speech.content === 'string' ? speech.content : String(speech.content ?? '');
  return (
    <motion.article initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="relative flex gap-3">
      <div className="flex w-10 shrink-0 flex-col items-center">
        <span className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold uppercase" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
          {agent.slice(0, 1)}
        </span>
        <span className="mt-2 h-full w-px" style={{ background: 'var(--border-light)' }} />
      </div>
      <div className="min-w-0 flex-1 rounded-lg border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: 'var(--radius-md)' }}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>{agent}</span>
          <span className="rounded-full px-2 py-0.5" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>{speech.model}</span>
          <span style={{ color: 'var(--text-muted)' }}>Round {speech.round}</span>
          <span className="rounded-full border px-2 py-0.5 font-medium capitalize" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>{speech.stance}</span>
        </div>
        <div className="prose prose-sm mt-3 max-w-none dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </div>
    </motion.article>
  );
}
