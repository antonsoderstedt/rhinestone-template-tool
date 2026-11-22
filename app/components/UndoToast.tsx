'use client';

import { useEffect, useRef } from 'react';
import { Undo2, X } from 'lucide-react';

import { useT } from '../lib/i18n';
export const UNDO_TOAST_DURATION_MS = 8000;

export interface UndoToastProps {
  /** Null hides the toast. */
  message: string | null;
  /** Changing this restarts the countdown (use one id per deletion). */
  toastId: number;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
}

/**
 * Bottom toast with an Undo button, used after destructive actions so no
 * delete is permanent for the first few seconds. The deletion itself happens
 * immediately; Undo restores what the caller kept in memory.
 */
export default function UndoToast({
  message,
  toastId,
  onUndo,
  onDismiss,
  durationMs = UNDO_TOAST_DURATION_MS,
}: UndoToastProps) {
  const t = useT();
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (message === null) return;
    const timeoutId = window.setTimeout(() => onDismissRef.current(), durationMs);
    return () => window.clearTimeout(timeoutId);
  }, [durationMs, message, toastId]);

  if (message === null) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900/95 px-4 py-3 text-sm text-zinc-100 shadow-2xl backdrop-blur-sm"
      >
        <span className="min-w-0 flex-1 truncate">{message}</span>
        <button
          type="button"
          onClick={onUndo}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-purple-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
          <Undo2 className="h-3.5 w-3.5" />
          {t('Undo')}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('Dismiss message')}
          className="shrink-0 rounded p-1 text-zinc-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
