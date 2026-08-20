export const workspaceInputClassName =
  'w-full rounded-[1.2rem] border border-border/80 bg-[rgba(255,255,255,0.88)] px-4 py-3 text-sm text-ink shadow-sm outline-none transition placeholder:text-ink-muted focus:border-accent-300 focus:bg-surface-raised focus:ring-2 focus:ring-accent-100';

export const workspaceSelectClassName =
  'w-full rounded-[1.2rem] border border-border/80 bg-[rgba(255,255,255,0.88)] px-4 py-3 text-sm text-ink shadow-sm outline-none transition focus:border-accent-300 focus:bg-surface-raised focus:ring-2 focus:ring-accent-100';

export const workspaceTextAreaClassName =
  'w-full rounded-[1.2rem] border border-border/80 bg-[rgba(255,255,255,0.88)] px-4 py-3 text-sm text-ink shadow-sm outline-none transition placeholder:text-ink-muted focus:border-accent-300 focus:bg-surface-raised focus:ring-2 focus:ring-accent-100';

export function WorkspacePage({
  children,
  tone = 'brand',
}: {
  children: React.ReactNode;
  tone?: 'brand' | 'accent' | 'neutral';
}) {
  const background = tone === 'accent'
    ? 'bg-[radial-gradient(circle_at_top_left,rgba(47,111,174,0.14),transparent_24%),linear-gradient(180deg,#faf8f5_0%,#f2ede6_100%)]'
    : tone === 'neutral'
      ? 'bg-[radial-gradient(circle_at_top_left,rgba(116,59,22,0.08),transparent_24%),linear-gradient(180deg,#faf8f5_0%,#f3eee7_100%)]'
      : 'bg-[radial-gradient(circle_at_top_left,rgba(180,104,53,0.14),transparent_24%),linear-gradient(180deg,#faf8f5_0%,#f2ede6_100%)]';

  return <div className={`min-h-full px-4 py-8 md:px-6 ${background}`}>{children}</div>;
}

export function WorkspaceHero({
  eyebrow,
  title,
  description,
  actions,
  aside,
  tone = 'brand',
}: {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
  actions?: React.ReactNode;
  aside?: React.ReactNode;
  tone?: 'brand' | 'accent' | 'neutral';
}) {
  const eyebrowTone = tone === 'accent'
    ? 'border-accent-500/15 bg-accent-50 text-accent-700'
    : tone === 'neutral'
      ? 'border-border bg-surface text-ink-secondary'
      : 'border-brand-500/15 bg-brand-50 text-brand-700';

  return (
    <section className="rounded-[2.4rem] border border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(246,241,232,0.88))] p-8 shadow-[0_18px_50px_rgba(36,31,23,0.08)]">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-4xl">
          <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${eyebrowTone}`}>
            {eyebrow}
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink md:text-5xl">{title}</h1>
          <p className="mt-4 max-w-4xl text-base leading-8 text-ink-secondary md:text-lg">{description}</p>
          {actions ? <div className="mt-6 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {aside ? <div className="w-full max-w-xl">{aside}</div> : null}
      </div>
    </section>
  );
}

export function WorkspaceSurface({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[2rem] border border-border/80 bg-[rgba(255,255,255,0.9)] shadow-sm ${className}`}>{children}</section>;
}

export function WorkspaceMetricCard({ label, value, description }: { label: string; value: string | number; description?: string }) {
  return (
    <div className="rounded-[1.6rem] border border-border/80 bg-[rgba(255,255,255,0.86)] px-5 py-5 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">{label}</div>
      <div className="mt-3 text-4xl font-semibold text-ink">{value}</div>
      {description ? <p className="mt-2 text-sm leading-6 text-ink-secondary">{description}</p> : null}
    </div>
  );
}

export function WorkspaceEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-[2rem] border border-dashed border-border-strong bg-[rgba(255,255,255,0.72)] px-8 py-16 text-center shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">Workspace cue</div>
      <h2 className="mt-3 text-2xl font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-ink-secondary">{description}</p>
    </section>
  );
}

export function WorkspaceTag({ children, tone = 'accent' }: { children: React.ReactNode; tone?: 'accent' | 'neutral' | 'success' }) {
  const style = tone === 'success'
    ? 'bg-success-50 text-success-600'
    : tone === 'neutral'
      ? 'bg-surface text-ink-secondary'
      : 'bg-accent-50 text-accent-700';
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${style}`}>{children}</span>;
}