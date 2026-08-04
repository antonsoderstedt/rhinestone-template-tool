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
      className: 'border-success-500/30 bg-success-500/12 text-success-600',
    },
    warning: {
      icon: AlertTriangle,
      className: 'border-warning-500/30 bg-warning-500/12 text-warning-600',
    },
    error: {
      icon: XCircle,
      className: 'border-danger-500/30 bg-danger-500/12 text-danger-600',
    },
    info: {
      icon: Info,
      className: 'border-border bg-surface-raised/95 text-ink',
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