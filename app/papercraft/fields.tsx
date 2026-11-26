'use client';

import { Info } from 'lucide-react';
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

/** A small round "i" that says what a setting does when the pointer rests on it (or when it has the keyboard focus). */
export function Tip({ text }: { text: string }) {
  return (
    <span title={text} aria-label={text} role="img" tabIndex={0} className="ml-1 inline-flex align-middle text-[var(--studio-ink-subtle)] hover:text-[var(--studio-ink)] focus:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400 rounded-full">
      <Info className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
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
  tip,
}: {
  label: string;
  valueMm: number;
  onChange: (mm: number) => void;
  minMm?: number;
  maxMm?: number;
  hint?: string;
  tip?: string;
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
        {tip && <Tip text={tip} />}
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
        title={tip}
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
  tip,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  tip?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-[var(--studio-ink-secondary)]">
        {label} {suffix && <span className="font-normal text-[var(--studio-ink-subtle)]">({suffix})</span>}
        {tip && <Tip text={tip} />}
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
        title={tip}
      />
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  tip,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  tip?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-[var(--studio-ink-secondary)]">
        {label}
        {tip && <Tip text={tip} />}
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value as T)} className={fieldClass} title={tip}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export function CheckField({ label, checked, onChange, tip }: { label: string; checked: boolean; onChange: (checked: boolean) => void; tip?: string }) {
  return (
    <label className="flex items-center gap-2 text-xs text-[var(--studio-ink-secondary)]" title={tip}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        {label}
        {tip && <Tip text={tip} />}
      </span>
    </label>
  );
}

/** A slider with the value shown beside the label. */
export function RangeField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  tip,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  tip?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 flex items-center justify-between text-xs font-medium text-[var(--studio-ink-secondary)]">
        <span>
          {label}
          {tip && <Tip text={tip} />}
        </span>
        <span className="font-normal text-[var(--studio-ink-subtle)]">
          {value}
          {suffix}
        </span>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} title={tip} className="w-full accent-violet-500" />
    </div>
  );
}
