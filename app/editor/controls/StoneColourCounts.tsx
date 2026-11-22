'use client';

import { useMemo } from 'react';
import { countStonesByColour, inkOn } from '../stoneColours';

/** How many stones of each colour, when the design has colours. Renders nothing for a one-colour design. */
export default function StoneColourCounts({ stones }: { stones: ReadonlyArray<{ metadata?: Record<string, unknown> }> }) {
  const counts = useMemo(() => countStonesByColour(stones), [stones]);
  if (counts.length === 0) return null;
  return (
    <div className="space-y-1.5" aria-label="Stones by colour">
      <ul className="space-y-1">
        {counts.map((entry) => (
          <li key={entry.hex} className="flex items-center gap-2 text-xs text-[var(--studio-ink-secondary)]">
            <span
              aria-hidden="true"
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-[var(--studio-border-strong)] px-1"
              style={{ backgroundColor: entry.hex, color: inkOn(entry.hex) }}
            />
            <span className="flex-1">{entry.label}</span>
            <span className="font-mono text-[var(--studio-ink)]">{entry.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
