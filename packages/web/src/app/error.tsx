'use client';

import { useEffect } from 'react';

// 路由段错误边界：page.tsx 任何视图渲染崩溃时，Shell/侧边栏保持可用，
// 主区域显示可恢复的报错面板，而不是无声空白。
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[hermes:view-error]', error);
  }, [error]);

  return (
    <div className="flex min-h-full items-center justify-center p-6" style={{ background: 'var(--bg-primary)' }}>
      <div role="alert" className="max-w-md rounded-lg border p-6 text-center" style={{ borderColor: 'var(--error)', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)' }}>
        <h2 className="text-base font-semibold" style={{ color: 'var(--error)' }}>视图渲染出错</h2>
        <p className="mt-2 break-all text-sm" style={{ color: 'var(--text-secondary)' }}>{error.message || 'Unknown error'}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-md px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--accent-primary)', color: 'var(--text-on-accent)', borderRadius: 'var(--radius-sm)' }}
        >
          重新加载视图
        </button>
      </div>
    </div>
  );
}
