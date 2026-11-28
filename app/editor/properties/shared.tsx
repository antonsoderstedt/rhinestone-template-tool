'use client';

import { EditorState, EditorAction } from '../EditorState';
import { type OutlineFontStatus } from '../controls/FontPicker';
import { type ArtworkInfo } from '../artworkGeneration';

export interface ToolPropertiesProps {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  outlineFontStatus?: OutlineFontStatus;
  artworkInfo?: ArtworkInfo | null;
}

export function PanelSection({ title, description, children, defaultOpen = true }: { title: string; description?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-md border border-[var(--studio-border)] bg-[var(--studio-surface)] shadow-sm">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-3 py-2.5 marker:hidden [&::-webkit-details-marker]:hidden">
        <span>
          <h2 className="block text-sm font-semibold text-[var(--studio-ink)]">{title}</h2>
          {description && <span className="mt-1 block text-xs leading-5 text-[var(--studio-ink-muted)]">{description}</span>}
        </span>
        <span className="mt-1 text-xs font-semibold text-[var(--studio-ink-subtle)] transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="space-y-3 border-t border-[var(--studio-border)] px-3 py-3">{children}</div>
    </details>
  );
}

/**
 * Surfaces a generation error (e.g. a font asset that failed to load) for
 * generator panels that don't otherwise show one. `outlineFontStatus` is a
 * single shared "last generation attempt" status set by EditorShell for
 * every generator, not just the outline text tool — panels other than the
 * outline text tool previously never rendered it, so failures were only
 * ever visible in the browser console.
 */
export function GeneratorErrorBanner({ outlineFontStatus }: { outlineFontStatus?: OutlineFontStatus }) {
  if (outlineFontStatus?.status !== 'error' || !outlineFontStatus.message) return null;
  return (
    <div role="alert" className="rounded-xl border border-danger-500/30 bg-danger-50 px-3 py-3 text-xs text-danger-600">
      {outlineFontStatus.message}
    </div>
  );
}
