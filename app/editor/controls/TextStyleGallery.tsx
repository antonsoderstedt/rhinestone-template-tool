'use client';

import { useEffect, useMemo, useState } from 'react';
import { getOutlineFontFaceCss, getOutlineFontDefinition } from '@/src/lib/rhinestone-engine/index';
import { DEFAULT_PREVIEW_TEXT } from '../../lib/fontLaunch';
import type { EditorAction } from '../EditorState';
import {
  actionsForTextStyle,
  currentTextStyle,
  currentWords,
  isSameTextStyle,
  type TextStyleState,
  listTextStyleGroups,
  type TextStyleOption,
} from '../textStyles';
import { alphabetThumbnail, dotMatrixThumbnail, stoneFontThumbnail, thumbnailText, type TextThumbnail } from '../textStyleThumbnails';
import { editorFieldLabelClassName } from './controlStyles';

interface TextStyleGalleryProps {
  state: TextStyleState;
  dispatch: React.Dispatch<EditorAction>;
}

export function DotsPicture({ thumbnail }: { thumbnail: TextThumbnail }) {
  const { viewBox, dots } = thumbnail;
  return (
    <svg
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      className="h-12 w-full"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {dots.map((dot, index) => (
        <circle key={index} cx={dot.x} cy={dot.y} r={dot.r * 0.9} fill="currentColor" />
      ))}
    </svg>
  );
}

/** The stones of a stone font, made when the card is first shown. */
function StoneFontPicture({ fontId, text }: { fontId: string; text: string }) {
  const [result, setResult] = useState<{ key: string; thumbnail: TextThumbnail | null } | null>(null);
  const key = `${fontId}|${thumbnailText(text, '')}`;
  useEffect(() => {
    let cancelled = false;
    void stoneFontThumbnail(fontId, text).then((thumbnail) => {
      if (!cancelled) setResult({ key, thumbnail });
    });
    return () => {
      cancelled = true;
    };
  }, [fontId, text, key]);

  const ready = result && result.key === key ? result : null;
  if (!ready) return <div className="h-12 w-full animate-pulse rounded bg-[var(--studio-hover-overlay)]" aria-label="Loading" />;
  if (!ready.thumbnail) return <p className="flex h-12 items-center text-xs text-[var(--studio-ink-muted)]">No preview</p>;
  return (
    <div>
      <DotsPicture thumbnail={ready.thumbnail} />
      {ready.thumbnail.isSample && <span className="sr-only">Showing the font&apos;s sample, it has none of your letters.</span>}
    </div>
  );
}

/** The stones of an alphabet, made when the card is first shown (the letter files are fetched once). */
function AlphabetPicture({ alphabetId, text }: { alphabetId: string; text: string }) {
  const [result, setResult] = useState<{ key: string; thumbnail: TextThumbnail | null } | null>(null);
  const key = `${alphabetId}|${thumbnailText(text, '')}`;
  useEffect(() => {
    let cancelled = false;
    void alphabetThumbnail(alphabetId, text).then((thumbnail) => {
      if (!cancelled) setResult({ key, thumbnail });
    });
    return () => {
      cancelled = true;
    };
  }, [alphabetId, text, key]);
  const ready = result && result.key === key ? result : null;
  if (!ready) return <div className="h-12 w-full animate-pulse rounded bg-[var(--studio-hover-overlay)]" aria-label="Loading" />;
  if (!ready.thumbnail) return <p className="flex h-12 items-center text-xs text-[var(--studio-ink-muted)]">No preview</p>;
  return <DotsPicture thumbnail={ready.thumbnail} />;
}

function OptionPicture({ option, text }: { option: TextStyleOption; text: string }) {
  const { choice } = option;
  const dots = useMemo(() => (choice.kind === 'dots' ? dotMatrixThumbnail(text) : null), [choice.kind, text]);
  if (choice.kind === 'outline') {
    const font = getOutlineFontDefinition(choice.fontId);
    return (
      <p
        className="flex h-12 items-center justify-center overflow-hidden whitespace-nowrap text-2xl leading-none"
        style={{ fontFamily: font.previewFontFamily }}
      >
        {thumbnailText(text, DEFAULT_PREVIEW_TEXT)}
      </p>
    );
  }
  if (choice.kind === 'dots') return dots ? <DotsPicture thumbnail={dots} /> : <p className="h-12" />;
  if (choice.kind === 'alphabet') return <AlphabetPicture alphabetId={choice.alphabetId} text={text} />;
  return <StoneFontPicture fontId={choice.fontId} text={text} />;
}

/**
 * Every look for the user's own words side by side. Picking one switches the tool behind the scenes and keeps the words.
 */
export default function TextStyleGallery({ state, dispatch }: TextStyleGalleryProps) {
  const groups = useMemo(() => listTextStyleGroups(), []);
  const current = currentTextStyle(state);
  const text = currentWords(state);

  return (
    <div className="space-y-3" role="group" aria-label="Text style">
      <style dangerouslySetInnerHTML={{ __html: getOutlineFontFaceCss() }} />
      <span className={editorFieldLabelClassName}>Style</span>
      {groups.map((group) => (
        <div key={group.id} className="space-y-1.5">
          <div>
            <p className="text-xs font-semibold text-[var(--studio-ink)]">{group.title}</p>
            <p className="text-xs text-[var(--studio-ink-muted)]">{group.description}</p>
          </div>
          <ul className="grid grid-cols-2 gap-2">
            {group.options.map((option) => {
              const selected = isSameTextStyle(current, option.choice);
              return (
                <li key={option.key}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={`${option.label}, ${option.note}`}
                    onClick={() => {
                      if (selected) return;
                      for (const action of actionsForTextStyle(state, option.choice)) dispatch(action);
                    }}
                    className={`flex h-full w-full flex-col gap-1 rounded-xl border px-2 pb-2 pt-2 text-left transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${
                      selected
                        ? 'border-violet-500 bg-violet-500/10 text-[var(--studio-ink)] shadow-sm'
                        : 'border-[var(--studio-border)] bg-[var(--studio-well)] text-[var(--studio-ink-secondary)] hover:border-violet-400/50 hover:text-[var(--studio-ink)]'
                    }`}
                  >
                    <OptionPicture option={option} text={text} />
                    <span className="truncate text-xs font-medium">{option.label}</span>
                    <span className="truncate text-xs text-[var(--studio-ink-muted)]">{option.note}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
