'use client';

import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

interface EditorToastProps {
  message: string;
  tone: 'success' | 'warning' | 'error' | 'info';
  onDismiss: () => void;
}

export default function EditorToast({ message, tone, onDismiss }: EditorToastProps) {
  const toneStyles = {
    success: {
      icon: CheckCircle2,
      className: 'border-green-500/30 bg-green-500/12 text-green-100',
    },
    warning: {
      icon: AlertTriangle,
      className: 'border-yellow-500/30 bg-yellow-500/12 text-yellow-100',
    },
    error: {
      icon: XCircle,
      className: 'border-red-500/30 bg-red-500/12 text-red-100',
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