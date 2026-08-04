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
        className="w-full max-w-md rounded-2xl border border-border bg-surface-sunken p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 rounded-xl p-2 ${tone === 'destructive' ? 'bg-danger-500/15 text-danger-600' : 'bg-accent-50 text-accent-600'}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <h2 id="editor-dialog-title" className="text-base font-semibold text-ink">{title}</h2>
              <p id="editor-dialog-description" className="mt-2 text-sm text-ink-secondary">{description}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-2 text-ink-muted transition hover:bg-surface-raised hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent-400"
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
            className={`rounded-lg px-3 py-2 text-sm font-medium text-ink-inverse focus:outline-none focus:ring-2 ${tone === 'destructive' ? 'bg-danger-500 hover:bg-danger-600 focus:ring-danger-400' : 'bg-accent-500 hover:bg-accent-600 focus:ring-accent-400'}`}
          >
            {confirmLabel}
          </button>
          {tertiaryAction && (
            <button
              onClick={tertiaryAction.onClick}
              className={`rounded-lg border px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 ${tertiaryAction.tone === 'destructive' ? 'border-danger-500/30 bg-danger-50 text-danger-600 hover:bg-danger-500/15 focus:ring-danger-400' : 'border-border bg-surface-raised text-ink hover:bg-surface-sunken focus:ring-accent-400'}`}
            >
              {tertiaryAction.label}
            </button>
          )}
          <button
            onClick={onCancel}
            className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm font-medium text-ink hover:bg-surface-sunken focus:outline-none focus:ring-2 focus:ring-accent-400"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}