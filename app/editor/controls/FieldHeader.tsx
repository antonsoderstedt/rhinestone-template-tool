'use client';

import { useId, useState } from 'react';
import { editorFieldLabelClassName } from './controlStyles';

/**
 * Field label with an optional (?) button that shows a plain-language explanation
 * under the label. The explanation is real text (not a hover-only tooltip), so it
 * works with keyboard, touch and screen readers.
 */
export default function FieldHeader({ label, help, htmlFor }: { label: string; help?: string; htmlFor?: string }) {
  const [open, setOpen] = useState(false);
  const helpId = useId();

  return (
    <div>
      <div className="flex items-center gap-1.5">
        {htmlFor ? (
          <label htmlFor={htmlFor} className={editorFieldLabelClassName}>{label}</label>
        ) : (
          <span className={editorFieldLabelClassName}>{label}</span>
        )}
        {help && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={helpId}
            aria-label={`What is ${label}?`}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--studio-border-strong)] text-xs font-semibold leading-none text-[var(--studio-ink-muted)] transition hover:text-[var(--studio-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            ?
          </button>
        )}
      </div>
      {help && open && (
        <p id={helpId} role="note" className="mt-1 rounded-md bg-[var(--studio-hover-overlay-soft)] px-2 py-1.5 text-xs leading-5 text-[var(--studio-ink-secondary)]">
          {help}
        </p>
      )}
    </div>
  );
}
