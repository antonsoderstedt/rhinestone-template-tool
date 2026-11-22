'use client';

import { useEffect, useMemo, useState } from 'react';
import { estimateStoneUsage, STONES_PER_GROSS, type StoneSizeId } from '@/src/lib/rhinestone-engine/index';
import {
  DEFAULT_STONE_ESTIMATE_SETTINGS,
  PACK_SIZE_OPTIONS,
  readStoneEstimateSettings,
  writeStoneEstimateSettings,
  type StoneEstimateSettings,
} from '../lib/stoneEstimateSettings';
import { editorFieldLabelClassName, editorInputClassName, editorSelectClassName } from './controls/controlStyles';

import { useT } from '../lib/i18n';
interface StoneEstimateCardProps {
  stones: ReadonlyArray<{ stoneSize: StoneSizeId }>;
}

function formatMoney(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** How many stones to buy: spare allowance, whole packs and, if the user types a price, the cost. */
export default function StoneEstimateCard({ stones }: StoneEstimateCardProps) {
  const t = useT();
  // Start from the defaults so the server and first client render match, then load what this browser remembers.
  const [settings, setSettings] = useState<StoneEstimateSettings>(DEFAULT_STONE_ESTIMATE_SETTINGS);
  useEffect(() => {
    const saved = readStoneEstimateSettings();
    queueMicrotask(() => setSettings(saved));
  }, []);

  const update = (next: StoneEstimateSettings) => {
    setSettings(next);
    writeStoneEstimateSettings(next);
  };

  const estimate = useMemo(
    () => estimateStoneUsage(stones, {
      wastePercent: settings.wastePercent,
      packSizeStones: settings.packSizeStones,
      pricePerPackBySize: settings.pricePerPackBySize,
    }),
    [settings, stones],
  );

  if (estimate.lines.length === 0) {
    return <p className="text-xs leading-5 text-[var(--studio-ink-muted)]">{t('Add stones to see how many to buy.')}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
        <label className="flex flex-col gap-1.5">
          <span className={editorFieldLabelClassName}>{t('Spare')}</span>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step={1}
              value={settings.wastePercent}
              onChange={(event) => {
                const value = event.target.valueAsNumber;
                if (Number.isFinite(value)) update({ ...settings, wastePercent: Math.min(100, Math.max(0, value)) });
              }}
              className={`${editorInputClassName} pr-8`}
              aria-label={t('Spare stones in percent')}
            />
            <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--studio-ink-muted)]">%</span>
          </div>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={editorFieldLabelClassName}>{t('Pack size')}</span>
          <select
            value={settings.packSizeStones}
            onChange={(event) => update({ ...settings, packSizeStones: Number(event.target.value) })}
            className={editorSelectClassName}
          >
            {PACK_SIZE_OPTIONS.map((option) => (
              <option key={option.stones} value={option.stones}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <ul className="space-y-2" aria-label={t('Stones to buy by size')}>
        {estimate.lines.map((line) => (
          <li key={line.stoneSize} className="rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-[var(--studio-ink)]">{line.stoneSize}</span>
              <span className="text-xs text-[var(--studio-ink-muted)]">{line.stoneCount.toLocaleString('en-US')} in the design</span>
            </div>
            <p className="mt-1 text-sm text-[var(--studio-ink-secondary)]">
              Buy <strong className="text-[var(--studio-ink)]">{line.packs}</strong> {line.packs === 1 ? 'pack' : 'packs'}
              {' '}({line.stonesWithSpare.toLocaleString('en-US')} stones, {line.gross} gross)
            </p>
            <label className="mt-2 flex items-center gap-2 text-xs text-[var(--studio-ink-muted)]">
              <span className="shrink-0">{t('Price per pack')}</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                placeholder={t('Optional')}
                value={settings.pricePerPackBySize[line.stoneSize] ?? ''}
                onChange={(event) => {
                  const prices = { ...settings.pricePerPackBySize };
                  const value = event.target.valueAsNumber;
                  if (Number.isFinite(value) && value >= 0) prices[line.stoneSize] = value;
                  else delete prices[line.stoneSize];
                  update({ ...settings, pricePerPackBySize: prices });
                }}
                className={`${editorInputClassName} py-1.5`}
                aria-label={`Price of one ${line.stoneSize} pack`}
              />
              {line.cost !== null && <span className="shrink-0 font-semibold text-[var(--studio-ink)]">{formatMoney(line.cost)}</span>}
            </label>
          </li>
        ))}
      </ul>

      <p className="text-xs leading-5 text-[var(--studio-ink-muted)]">
        {estimate.totalCost !== null
          ? <>Total <strong className="text-[var(--studio-ink)]">{formatMoney(estimate.totalCost)}</strong>{estimate.costComplete ? '' : ' (only the sizes you gave a price)'}. </>
          : 'Type what a pack costs to see the total. '}
        A gross is {STONES_PER_GROSS} stones. Spare covers stones you drop or set wrong.
      </p>
    </div>
  );
}
