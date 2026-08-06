import * as React from 'react';
import { cn } from '@/lib/cn';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(({ className, type, ...props }, ref) => (
  <input type={type} className={cn('flex h-9 w-full rounded-md border border-zinc-200 bg-transparent px-3 py-1 text-sm shadow-sm outline-none placeholder:text-zinc-400 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700', className)} ref={ref} {...props} />
));
Input.displayName = 'Input';
export { Input };
