'use client';

import { useShell } from '@/components/shell/Shell';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { ChatView } from '@/components/chat/ChatView';
import { DAGCanvas } from '@/components/canvas/DAGCanvas';
import { RoundtableView } from '@/components/roundtable/RoundtableView';
import { DashboardView } from '@/components/dashboard/DashboardView';

export default function Home() {
  const { currentView } = useShell();
  return <div className="relative h-full overflow-hidden"><AnimatedView active={currentView === 'chat'}><ChatView /></AnimatedView><AnimatedView active={currentView === 'canvas'}><DAGCanvas /></AnimatedView><AnimatedView active={currentView === 'roundtable'}><RoundtableView /></AnimatedView><AnimatedView active={currentView === 'dashboard'}><DashboardView /></AnimatedView></div>;
}

function AnimatedView({ active, children }: { active: boolean; children: ReactNode }) {
  return <motion.div initial={false} animate={{ opacity: active ? 1 : 0, y: active ? 0 : 8 }} transition={{ duration: 0.2, ease: 'easeOut' }} className={active ? 'relative h-full' : 'pointer-events-none absolute inset-0'} aria-hidden={!active}>{children}</motion.div>;
}
