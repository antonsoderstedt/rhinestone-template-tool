'use client';

import { useEffect, useState } from 'react';
import type { StoneSizeId } from '@/src/lib/rhinestone-engine/index';
import {
  defaultStoneFontSpacing,
  describeFit,
  measureStoneFontSizes,
  stoneFontSizeSuggestion,
  type StoneFontSizeOption,
} from '../stoneFontSizes';
import { editorFieldLabelClassName } from './controlStyles';

import { useT } from '../../lib/i18n';
interface StoneFontSizeControlProps {
  fontId: string;
  text: string;
  stoneSize: StoneSizeId;
  /** What the user typed; empty means the editor's default for the font. */
  letterSpacingMm: number | '';
  lineSpacingMm: number | '';
  onPick: (size: StoneSizeId) => void;
}

const mm = (value: number) => `${Math.round(value)}`;

/**
 * A stone font cannot be scaled, so the stone size is the only way to make the words smaller or larger.
 * This shows how big the user's words come out at every size the font has, and which one is the biggest that fits a mat.
 */
export default function StoneFontSizeControl({ fontId, text, stoneSize, letterSpacingMm, lineSpacingMm, onPick }: StoneFontSizeControlProps) {
  const t = useT();
  const defaults = defaultStoneFontSpacing(fontId);
  const letter = typeof letterSpacingMm === 'number' ? letterSpacingMm : defaults.letterSpacingMm;
  const line = typeof lineSpacingMm === 'number' ? lineSpacingMm : defaults.lineSpacingMm;
  const key = `${fontId}|${text}|${letter}|${line}`;
  const [result, setResult] = useState<{ key: string; options: StoneFontSizeOption[] } | null>(null);

  useEffect(() => {
    if (!text.trim()) return;
    let cancelled = false;
    void measureStoneFontSizes({ fontId, text, letterSpacingMm: letter, lineSpacingMm: line }).then((options) => {
      if (!cancelled) setResult({ key, options });
    });
    return () => {
      cancelled = true;
    };
  }, [fontId, text, letter, line, key]);

  if (!text.trim()) return null;
  const options = result && result.key === key ? result.options : null;
  if (!options) return <p className="text-xs text-[var(--studio-ink-muted)]" role="status">{t('Measuring your words…')}</p>;
  if (options.every((option) => option.widthMm === null)) return null;

  const suggestion = stoneFontSizeSuggestion(options, stoneSize);

  return (
    <div className="space-y-2" role="group" aria-label={t('How big your words come out')}>
      <span className={editorFieldLabelClassName}>{t('Size of your words')}</span>
      <ul className="space-y-1">
        {options.map((option) => (
          <li key={option.size}>
            <button
              type="button"
              aria-pressed={option.size === stoneSize}
              disabled={option.widthMm === null}
              onClick={() => onPick(option.size)}
              className={`flex w-full items-baseline justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-accent-400 disabled:opacity-50 ${
                option.size === stoneSize
                  ? 'border-violet-500 bg-violet-500/10 text-[var(--studio-ink)]'
                  : 'border-[var(--studio-border)] bg-[var(--studio-well)] text-[var(--studio-ink-secondary)] hover:border-violet-400/50'
              }`}
            >
              <span className="font-medium">{option.size}</span>
              <span className="text-[var(--studio-ink-muted)]">
                {option.widthMm === null ? 'no letters of yours in this font' : `${mm(option.widthMm)} × ${mm(option.heightMm!)} mm · ${describeFit(option.fit)}`}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {options.length === 1 && (
        <p className="text-xs text-[var(--studio-ink-muted)]">This font only comes in {options[0]!.size}, so the size of the words depends on the text. Use fewer or shorter words, or another font, to change it.</p>
      )}
      {suggestion && (
        <button
          type="button"
          onClick={() => onPick(suggestion.size)}
          className="w-full rounded-lg border border-violet-400/50 bg-violet-500/10 px-3 py-2 text-xs font-medium text-[var(--studio-ink)] transition hover:bg-violet-500/20 focus:outline-none focus:ring-2 focus:ring-accent-400"
        >
          Use {suggestion.size}: {mm(suggestion.widthMm!)} × {mm(suggestion.heightMm!)} mm, {describeFit(suggestion.fit)}
        </button>
      )}
    </div>
  );
}
