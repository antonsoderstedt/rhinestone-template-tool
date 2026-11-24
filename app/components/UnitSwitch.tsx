'use client';

import { setUnit, useUnit, type LengthUnit } from '../lib/units';
import { useT } from '../lib/i18n';

/** mm / in. Sizes are shown and typed in the chosen unit everywhere; the design itself is always in millimetres. */
export default function UnitSwitch({ className = '' }: { className?: string }) {
  const unit = useUnit();
  const t = useT();
  return (
    <div role="group" aria-label={t('Unit')} className={`inline-flex overflow-hidden rounded-md border border-white/10 text-xs font-medium ${className}`}>
      {(['mm', 'in'] as LengthUnit[]).map((choice) => (
        <button
          key={choice}
          type="button"
          aria-pressed={unit === choice}
          onClick={() => setUnit(choice)}
          className={`px-2.5 py-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${unit === choice ? 'bg-violet-500/35 text-white' : 'bg-white/5 text-zinc-400 hover:text-zinc-100'}`}
        >
          {choice}
        </button>
      ))}
    </div>
  );
}
