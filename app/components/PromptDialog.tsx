'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import Modal from '../editor/ui/Modal';

export interface PromptDialogProps {
  open: boolean;
  title: string;
  /** Short explanation shown under the title. */
  description?: string;
  label: string;
  /** Starting value of the text field. */
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Return an error message to block submit, or null when the value is fine. */
  validate?: (value: string) => string | null;
  /** Called with the trimmed value. */
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

/** Default validation: a non-empty name no longer than 80 characters. */
export function validatePromptName(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Enter a name.';
  if (trimmed.length > 80) return 'Use 80 characters or fewer.';
  return null;
}

function PromptDialogContent({
  title,
  description,
  label,
  initialValue = '',
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  validate = validatePromptName,
  onSubmit,
  onCancel,
  titleId,
  descriptionId,
}: Omit<PromptDialogProps, 'open'> & { titleId: string; descriptionId: string }) {
  const [value, setValue] = useState(initialValue);
  const [touched, setTouched] = useState(false);
  const error = validate(value);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  // Modal focuses its first focusable element (the close button) after mount;
  // move focus to the name field once that has happened.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (error) return;
    onSubmit(value.trim());
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id={titleId} className="text-base font-semibold text-white">{title}</h2>
          {description && <p id={descriptionId} className="mt-1.5 text-sm text-zinc-400">{description}</p>}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <label htmlFor={inputId} className="mt-4 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-invalid={touched && error ? true : undefined}
        aria-describedby={touched && error ? `${inputId}-error` : undefined}
        className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
      />
      {touched && error && (
        <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-xs text-red-400">{error}</p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
          {cancelLabel}
        </button>
        <button
          type="submit"
          className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
          {confirmLabel}
        </button>
      </div>
    </form>
  );
}

/**
 * In-page replacement for `window.prompt`. Works in embedded contexts where
 * `prompt()` is blocked, is keyboard accessible, and validates the value.
 * The inner form remounts per open so its state is always fresh.
 */
export default function PromptDialog(props: PromptDialogProps) {
  const { open, onCancel, ...content } = props;
  const reactId = useId();
  const titleId = `prompt-title-${reactId}`;
  const descriptionId = `prompt-description-${reactId}`;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      titleId={titleId}
      descriptionId={props.description ? descriptionId : undefined}
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <PromptDialogContent {...content} onCancel={onCancel} titleId={titleId} descriptionId={descriptionId} />
    </Modal>
  );
}
