'use client';

import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

interface EditorToastProps {
  message: string;
  tone: 'success' | 'warning' | 'error' | 'info';
  onDismiss: () => void;
  /** Optional inline action, e.g. Undo after a delete. */
  action?: { label: string; onClick: () => void };
}

export default function EditorToast({ message, tone, onDismiss, action }: EditorToastProps) {
  // Toasts keep their own dark surface in both studio themes: the pale tinted text is only readable on it
  // (a translucent tint over the light theme gave pale text on a pale background).
  const toneStyles = {
    success: {
      icon: CheckCircle2,
      className: 'border-green-500/40 bg-zinc-900/95 text-green-100',
    },
    warning: {
      icon: AlertTriangle,
      className: 'border-yellow-500/40 bg-zinc-900/95 text-yellow-100',
    },
    error: {
      icon: XCircle,
      className: 'border-red-500/40 bg-zinc-900/95 text-red-100',
    },
    info: {
      icon: Info,
      className: 'border-zinc-700 bg-zinc-900/95 text-zinc-100',
    },
  }[tone];

  const Icon = toneStyles.icon;

  return (
    <div className={`max-w-sm rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-sm ${toneStyles.className}`} role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="flex-1 text-sm">{message}</p>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="shrink-0 rounded-md bg-white/15 px-2 py-0.5 text-xs font-semibold text-current transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            {action.label}
          </button>
        )}
        <button
          onClick={onDismiss}
          className="text-current/70 transition hover:text-current"
          aria-label="Dismiss message"
          title="Dismiss message"
        >
          <XCircle className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}