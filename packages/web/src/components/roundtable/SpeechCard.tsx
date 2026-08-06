'use client';

import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { RoundtableSpeech } from '@hermes/shared';
import { cn } from '@/lib/cn';

const stanceColors: Record<RoundtableSpeech['stance'], string> = { propose: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300', agree: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', challenge: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300', supplement: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300', moderate: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300', synthesize: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' };
export function SpeechCard({ speech }: { speech: RoundtableSpeech }) {
  return <motion.article initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="relative flex gap-3"><div className="flex w-10 shrink-0 flex-col items-center"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold uppercase text-blue-700 dark:bg-blue-950 dark:text-blue-300">{speech.agent.slice(0, 1)}</span><span className="mt-2 h-full w-px bg-zinc-200 dark:bg-zinc-800" /></div><div className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"><div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold capitalize">{speech.agent}</span><span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-500 dark:bg-zinc-800">{speech.model}</span><span className="text-zinc-400">Round {speech.round}</span><span className={cn('rounded-full px-2 py-0.5 font-medium capitalize', stanceColors[speech.stance])}>{speech.stance}</span></div><div className="prose prose-sm mt-3 max-w-none dark:prose-invert"><ReactMarkdown remarkPlugins={[remarkGfm]}>{speech.content}</ReactMarkdown></div></div></motion.article>;
}
