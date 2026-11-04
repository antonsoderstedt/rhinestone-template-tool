import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

export type WorkspaceStatus = 'Ready' | 'Warning' | 'Blocked';

export interface WorkspaceModeBannerProps {
  mode: string;
  status: WorkspaceStatus;
  project: string;
  guidance: string;
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

export default function WorkspaceModeBanner({ mode, status, project, guidance, calibrationState }: WorkspaceModeBannerProps) {
  const { Icon, badgeClassName, iconClassName, labelClassName } = statusConfig[status];

  const calibrationToneClassName = calibrationState?.tone === 'success'
    ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300'
    : calibrationState?.tone === 'danger'
      ? 'border-rose-400/30 bg-rose-500/15 text-rose-300'
      : 'border-amber-400/30 bg-amber-500/15 text-amber-300';

  return (
    <section className="border-b border-[var(--studio-border)] bg-[var(--studio-surface)]">
      <div className="mx-auto max-w-[1600px] px-4 py-3 md:px-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-violet-400/30 bg-violet-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200">
              {mode}
            </span>
            <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${badgeClassName}`}>
              <Icon className={`h-3.5 w-3.5 ${iconClassName}`} />
              {status}
            </span>
            {calibrationState && (
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${calibrationToneClassName}`}>
                {calibrationState.label}
              </span>
            )}
          </div>

          <div className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${labelClassName}`}>
            {project}
          </div>
        </div>

        <p className="mt-2 max-w-4xl text-xs leading-5 text-[var(--studio-ink-secondary)]">
          {guidance}
        </p>
      </div>
    </section>
  );
}
