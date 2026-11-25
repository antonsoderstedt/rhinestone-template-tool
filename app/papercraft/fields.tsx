'use client';

import { useId, useState, type ReactNode } from 'react';
import { MM_PER_INCH, useUnit } from '../lib/units';

export function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-md border border-[var(--studio-border)] bg-[var(--studio-surface)] shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 marker:hidden [&::-webkit-details-marker]:hidden">
        <h2 className="text-sm font-semibold text-[var(--studio-ink)]">{title}</h2>
        <span aria-hidden="true" className="text-xs font-semibold text-[var(--studio-ink-subtle)] transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="space-y-3 border-t border-[var(--studio-border)] px-3 py-3">{children}</div>
    </details>
  );
}

const fieldClass =
  'h-9 w-full rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-2 text-sm text-[var(--studio-ink)] focus-visible:ring-2 focus-visible:ring-violet-400';

/** A length, always stored in millimetres, shown and typed in the unit the person chose (mm or inches). */
export function LengthField({
  label,
  valueMm,
  onChange,
  minMm = 0,
  maxMm = 5000,
  hint,
}: {
  label: string;
  valueMm: number;
  onChange: (mm: number) => void;
  minMm?: number;
  maxMm?: number;
  hint?: string;
}) {
  const id = useId();
  const unit = useUnit();
  const factor = unit === 'in' ? MM_PER_INCH : 1;
  const decimals = unit === 'in' ? 2 : 1;
  const shown = (valueMm / factor).toFixed(decimals);
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-[var(--studio-ink-secondary)]">
        {label} <span className="font-normal text-[var(--studio-ink-subtle)]">({unit})</span>
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={unit === 'in' ? 0.05 : 0.5}
        value={draft ?? shown}
        onChange={(event) => {
          setDraft(event.target.value);
          const n = Number(event.target.value);
          if (Number.isFinite(n) && event.target.value !== '') {
            const mm = n * factor;
            if (mm >= minMm && mm <= maxMm) onChange(mm);
          }
        }}
        onBlur={() => setDraft(null)}
        className={fieldClass}
      />
      {hint && <p className="mt-1 text-xs text-[var(--studio-ink-subtle)]">{hint}</p>}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-[var(--studio-ink-secondary)]">
        {label} {suffix && <span className="font-normal text-[var(--studio-ink-subtle)]">({suffix})</span>}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={draft ?? String(value)}
        onChange={(event) => {
          setDraft(event.target.value);
          const n = Number(event.target.value);
          if (Number.isFinite(n) && event.target.value !== '' && n >= min && n <= max) onChange(n);
        }}
        onBlur={() => setDraft(null)}
        className={fieldClass}
      />
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-[var(--studio-ink-secondary)]">{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value as T)} className={fieldClass}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-[var(--studio-ink-secondary)]">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}
