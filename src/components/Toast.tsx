import { useEffect } from 'react';
import { cn } from '@/lib/cn';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
  variant?: ToastVariant;
}

const variantClass: Record<ToastVariant, string> = {
  success: 'bg-[#1d9e75] text-white border-emerald-700',
  error: 'bg-red-600 text-white border-red-700',
  warning: 'bg-amber-500 text-white border-amber-600',
  info: 'bg-slate-800 text-white border-slate-900',
};

export function Toast({ message, onDismiss, durationMs = 3200, variant = 'info' }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(t);
  }, [message, onDismiss, durationMs]);

  if (!message) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-6 left-1/2 z-[100] max-w-md -translate-x-1/2 px-4"
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          'pointer-events-auto flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg',
          variantClass[variant],
        )}
      >
        {variant === 'success' && (
          <svg className="size-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {variant === 'error' && (
          <svg className="size-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {variant === 'warning' && (
          <svg className="size-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
              clipRule="evenodd"
            />
          </svg>
        )}
        <span className="flex-1">{message}</span>
      </div>
    </div>
  );
}
