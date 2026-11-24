// Control styles follow the studio theme (--studio-* tokens in globals.css), so the
// same controls read correctly in both the dark and the light studio.
export const editorFieldLabelClassName = 'text-xs font-medium uppercase tracking-[0.14em] text-[var(--studio-ink-muted)]';

const editorFieldBase =
  'w-full rounded-md border border-[var(--studio-border-strong)] bg-[var(--studio-well)] px-3 py-2 text-sm text-[var(--studio-ink)] outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-400';

export const editorInputClassName =
  `${editorFieldBase} placeholder:text-[var(--studio-ink-subtle)] disabled:cursor-not-allowed disabled:bg-[var(--studio-surface-2)] disabled:text-[var(--studio-ink-subtle)]`;

export const editorSelectClassName = editorFieldBase;

export const editorTextareaClassName =
  `${editorFieldBase} placeholder:text-[var(--studio-ink-subtle)]`;

export const editorSegmentBaseClassName =
  'rounded-md border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-violet-400';

export const editorSegmentActiveClassName =
  'border-violet-400/70 bg-violet-500/20 text-[var(--studio-ink)] shadow-sm';

export const editorSegmentIdleClassName =
  'border-[var(--studio-border)] bg-[var(--studio-surface-2)] text-[var(--studio-ink-secondary)] hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-surface-hover)] hover:text-[var(--studio-ink)]';

export const editorNoteClassName =
  'rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-3 py-2 text-xs leading-5 text-[var(--studio-ink-muted)]';
