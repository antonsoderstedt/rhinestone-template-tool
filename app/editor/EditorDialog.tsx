'use client';

import { AlertTriangle, Info, Sparkles, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface EditorDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: 'default' | 'destructive';
  icon?: 'sparkles' | 'warning' | 'info';
  tertiaryAction?: {
    label: string;
    onClick: () => void;
    tone?: 'default' | 'destructive';
  };
}

export default function EditorDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  tone = 'default',
  icon = 'info',
  tertiaryAction,
}: EditorDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    confirmButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusedElementRef.current?.focus();
    };
  }, [open, onCancel]);

  if (!open) return null;

  const Icon = icon === 'warning' ? AlertTriangle : icon === 'sparkles' ? Sparkles : Info;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-dialog-title"
        aria-describedby="editor-dialog-description"
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 rounded-xl p-2 ${tone === 'destructive' ? 'bg-red-500/15 text-red-300' : 'bg-purple-500/15 text-purple-300'}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <h2 id="editor-dialog-title" className="text-base font-semibold text-white">{title}</h2>
              <p id="editor-dialog-description" className="mt-2 text-sm text-zinc-400">{description}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            aria-label="Close dialog"
            title="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            className={`rounded-lg px-3 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 ${tone === 'destructive' ? 'bg-red-600 hover:bg-red-500 focus:ring-red-400' : 'bg-purple-600 hover:bg-purple-500 focus:ring-purple-400'}`}
          >
            {confirmLabel}
          </button>
          {tertiaryAction && (
            <button
              onClick={tertiaryAction.onClick}
              className={`rounded-lg border px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 ${tertiaryAction.tone === 'destructive' ? 'border-red-500/30 bg-red-500/10 text-red-100 hover:bg-red-500/20 focus:ring-red-400' : 'border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 focus:ring-purple-400'}`}
            >
              {tertiaryAction.label}
            </button>
          )}
          <button
            onClick={onCancel}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}