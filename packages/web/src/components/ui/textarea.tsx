import * as React from 'react';
import { cn } from '@/lib/cn';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(({ className, ...props }, ref) => (
  <textarea className={cn('flex min-h-20 w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm shadow-sm outline-none placeholder:text-zinc-400 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700', className)} ref={ref} {...props} />
));
Textarea.displayName = 'Textarea';
export { Textarea };
