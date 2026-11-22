import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

export type WorkspaceStatus = 'Ready' | 'Warning' | 'Blocked';

export interface StatusChip {
  label: string;
  tone: 'neutral' | 'success' | 'warning';
}

export interface WorkspaceModeBannerProps {
  mode: string;
  status: WorkspaceStatus;
  project: string;
  guidance: string;
  /** Short facts shown as chips. When the status is Ready the sentence below is only for screen readers. */
  chips?: readonly StatusChip[];
  /** One button for the most useful fix, shown next to the chips. */
  action?: { label: string; onClick: () => void };
  calibrationState?: {
    label: string;
    tone: 'success' | 'warning' | 'danger';
  };
}

const statusConfig: Record<WorkspaceStatus, { labelClassName: string; iconClassName: string; badgeClassName: string; Icon: typeof CheckCircle2 }> = {
  Ready: {
    labelClassName: 'text-emerald-400',
    iconClassName: 'text-emerald-400',
    badgeClassName: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300',
    Icon: CheckCircle2,
  },
  Warning: {
    labelClassName: 'text-amber-400',
    iconClassName: 'text-amber-400',
    badgeClassName: 'border-amber-400/30 bg-amber-500/15 text-amber-300',
    Icon: AlertTriangle,
  },
  Blocked: {
    labelClassName: 'text-rose-400',
    iconClassName: 'text-rose-400',
    badgeClassName: 'border-rose-400/30 bg-rose-500/15 text-rose-300',
    Icon: ShieldAlert,
  },
};

export default function WorkspaceModeBanner({ mode, status, project, guidance, chips, action, calibrationState }: WorkspaceModeBannerProps) {
  const { Icon, badgeClassName, iconClassName, labelClassName } = statusConfig[status];
  // On a phone long guidance (size warnings, say) is clamped to two lines until the user opens it.
  const [expanded, setExpanded] = useState(false);
  // With chips, a Ready design needs no sentence; anything that needs attention still gets its explanation.
  const guidanceHidden = chips !== undefined && status === 'Ready';
  const longGuidance = guidance.length > 90 && !guidanceHidden;

  const calibrationToneClassName = calibrationState?.tone === 'success'
    ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300'
    : calibrationState?.tone === 'danger'
      ? 'border-rose-400/30 bg-rose-500/15 text-rose-300'
      : 'border-amber-400/30 bg-amber-500/15 text-amber-300';

  return (
    <section aria-label="Studio status" className="border-b border-[var(--studio-border)] bg-[var(--studio-surface)]">
      <div className="mx-auto max-w-[1600px] px-4 py-3 md:px-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-violet-400/30 bg-violet-500/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">
              {mode}
            </span>
            <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${badgeClassName}`}>
              <Icon className={`h-3.5 w-3.5 ${iconClassName}`} />
              {status}
            </span>
            {chips?.map((chip) => (
              <span
                key={chip.label}
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
                  chip.tone === 'warning'
                    ? 'border-amber-400/30 bg-amber-500/10 text-amber-300'
                    : chip.tone === 'success'
                      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-[var(--studio-border)] bg-[var(--studio-hover-overlay-soft)] text-[var(--studio-ink-secondary)]'
                }`}
              >
                {chip.label}
              </span>
            ))}
            {action && (
              <button
                type="button"
                onClick={action.onClick}
                className="inline-flex items-center rounded-full border border-violet-400/40 bg-violet-500/20 px-3 py-1 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/30 focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                {action.label}
              </button>
            )}
            {calibrationState && (
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${calibrationToneClassName}`}>
                {calibrationState.label}
              </span>
            )}
          </div>

          <div className={`text-xs font-semibold uppercase tracking-[0.2em] max-lg:hidden ${labelClassName}`}>
            {project}
          </div>
        </div>

        <p className={guidanceHidden ? 'sr-only' : `mt-2 max-w-4xl text-xs leading-5 text-[var(--studio-ink-secondary)] ${expanded ? '' : 'max-lg:line-clamp-2'}`}>
          {guidance}
        </p>
        {longGuidance && (
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            className="mt-1 text-xs font-semibold text-violet-300 underline-offset-2 hover:underline lg:hidden"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    </section>
  );
}
