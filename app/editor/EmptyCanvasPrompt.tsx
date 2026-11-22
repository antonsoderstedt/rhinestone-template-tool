'use client';

import { TEXT_EXAMPLES } from './editorUi';

import { useT } from '../lib/i18n';
/** Shown over an empty canvas: a big text box and one-tap examples. */
export default function EmptyCanvasPrompt({ onText }: { onText: (text: string) => void }) {
  const t = useT();
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-5 text-center shadow-xl">
        <h2 className="text-base font-semibold text-[var(--studio-ink)]">{t('What do you want to make?')}</h2>
        <p className="mt-1 text-xs text-[var(--studio-ink-muted)]">{t('Type a name or word and it turns into rhinestone stones.')}</p>
        <input
          type="text"
          autoFocus
          aria-label={t('Your text')}
          placeholder={t('Your name')}
          onChange={(event) => onText(event.target.value)}
          className="mt-4 w-full rounded-xl border border-[var(--studio-border-strong)] bg-[var(--studio-well)] px-4 py-3 text-center text-xl tracking-wide text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          <span className="text-xs uppercase tracking-[0.14em] text-[var(--studio-ink-muted)]">{t('Or try')}</span>
          {TEXT_EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              onClick={() => onText(example.text)}
              className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-well)] px-3 py-1 text-xs text-[var(--studio-ink-secondary)] transition hover:border-violet-400/50 hover:text-[var(--studio-ink)]"
            >
              {example.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
