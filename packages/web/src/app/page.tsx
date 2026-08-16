'use client';

import { useShell } from '@/components/shell/Shell';
import { motion } from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';
import { ChatView } from '@/components/chat/ChatView';
import { DAGCanvas } from '@/components/canvas/DAGCanvas';
import { RoundtableView } from '@/components/roundtable/RoundtableView';
import { DashboardView } from '@/components/dashboard/DashboardView';

export default function Home() {
  const { currentView } = useShell();
  const containerRef = useRef<HTMLDivElement>(null);
  // 切换视图时重置滚动位置：常驻挂载的不可见视图内容若曾把共享滚动容器拉走，
  // 切回/切走时都应回到顶部，避免看到"被顶出可视区"的空白。
  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0, left: 0 });
    containerRef.current?.parentElement?.scrollTo({ top: 0, left: 0 });
  }, [currentView]);
  return <div ref={containerRef} className="relative h-full overflow-hidden"><AnimatedView active={currentView === 'chat'}><ChatView /></AnimatedView><AnimatedView active={currentView === 'canvas'}><DAGCanvas /></AnimatedView><AnimatedView active={currentView === 'roundtable'}><RoundtableView /></AnimatedView><AnimatedView active={currentView === 'dashboard'}><DashboardView /></AnimatedView></div>;
}

function AnimatedView({ active, children }: { active: boolean; children: ReactNode }) {
  return <motion.div initial={false} animate={{ opacity: active ? 1 : 0, y: active ? 0 : 8 }} transition={{ duration: 0.2, ease: 'easeOut' }} className={active ? 'relative h-full' : 'pointer-events-none absolute inset-0'} aria-hidden={!active}>{children}</motion.div>;
}
