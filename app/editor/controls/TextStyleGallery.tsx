'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFontCatalogRevision } from '@/app/lib/useFontCatalog';
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
import { useFontPreviewLoader } from '../../fonts/useFontPreviewLoader';

import { useT } from '../../lib/i18n';
/** How many looks a group draws before "show more". */
const PAGE_SIZE = 24;

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
  const t = useT();
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
  if (!ready) return <div className="h-12 w-full animate-pulse rounded bg-[var(--studio-hover-overlay)]" aria-label={t('Loading')} />;
  if (!ready.thumbnail) return <p className="flex h-12 items-center text-xs text-[var(--studio-ink-muted)]">{t('No preview')}</p>;
  return (
    <div>
      <DotsPicture thumbnail={ready.thumbnail} />
      {ready.thumbnail.isSample && <span className="sr-only">Showing the font&apos;s sample, it has none of your letters.</span>}
    </div>
  );
}

/** The stones of an alphabet, made when the card is first shown (the letter files are fetched once). */
function AlphabetPicture({ alphabetId, text }: { alphabetId: string; text: string }) {
  const t = useT();
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
  if (!ready) return <div className="h-12 w-full animate-pulse rounded bg-[var(--studio-hover-overlay)]" aria-label={t('Loading')} />;
  if (!ready.thumbnail) return <p className="flex h-12 items-center text-xs text-[var(--studio-ink-muted)]">{t('No preview')}</p>;
  return <DotsPicture thumbnail={ready.thumbnail} />;
}

/** The words in a traced font. A library font's file is fetched when its card is shown (the bundled ones are declared in CSS). */
function OutlineWords({ fontId, text }: { fontId: string; text: string }) {
  const font = getOutlineFontDefinition(fontId);
  const fromLibrary = font.sourceKind === 'workspace-installed' || font.sourceKind === 'browser-uploaded';
  const specs = useMemo(
    () => (fromLibrary && font.assetUrl ? [{ family: font.previewFontFamily, url: font.assetUrl, weight: font.fontWeight, style: font.fontStyle }] : []),
    [fromLibrary, font.assetUrl, font.previewFontFamily, font.fontWeight, font.fontStyle],
  );
  useFontPreviewLoader(specs);
  return (
    <p
      className="flex h-12 items-center justify-center overflow-hidden whitespace-nowrap text-2xl leading-none"
      style={{ fontFamily: `'${font.previewFontFamily}', system-ui, sans-serif` }}
    >
      {thumbnailText(text, DEFAULT_PREVIEW_TEXT)}
    </p>
  );
}

function OptionPicture({ option, text }: { option: TextStyleOption; text: string }) {
  const { choice } = option;
  const dots = useMemo(() => (choice.kind === 'dots' ? dotMatrixThumbnail(text) : null), [choice.kind, text]);
  if (choice.kind === 'outline') return <OutlineWords fontId={choice.fontId} text={text} />;
  if (choice.kind === 'dots') return dots ? <DotsPicture thumbnail={dots} /> : <p className="h-12" />;
  if (choice.kind === 'alphabet') return <AlphabetPicture alphabetId={choice.alphabetId} text={text} />;
  return <StoneFontPicture fontId={choice.fontId} text={text} />;
}

/** The text after the user has stopped typing for a moment, so a picture is not remade for every key. */
function useSettled(value: string, delayMs = 600): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

/** Mounts its children only once it has been scrolled near the screen, so pictures that are never seen are never made. */
function WhenVisible({ children, placeholderClassName }: { children: React.ReactNode; placeholderClassName: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || seen) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      queueMicrotask(() => setSeen(true));
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setSeen(true);
        observer.disconnect();
      }
    }, { rootMargin: '120px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [seen]);
  return <div ref={ref}>{seen ? children : <div className={placeholderClassName} />}</div>;
}

/**
 * Every look for the user's own words side by side. Picking one switches the tool behind the scenes and keeps the words.
 */
export default function TextStyleGallery({ state, dispatch }: TextStyleGalleryProps) {
  const t = useT();
  const fontCatalogRevision = useFontCatalogRevision();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the groups change when the font library has loaded
  const groups = useMemo(() => listTextStyleGroups(), [fontCatalogRevision]);
  const current = currentTextStyle(state);
  const text = useSettled(currentWords(state));
  // The groups whose pictures have to be fetched (stone fonts, alphabets) stay closed until asked for, unless one of them is in use.
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const isOpen = (groupId: string) =>
    groupId === 'traced' || opened.has(groupId) || groups.some((group) => group.id === groupId && group.options.some((option) => isSameTextStyle(current, option.choice)));
  // A group can hold thousands of looks. Only a page of them is drawn, the rest is a search and a "show more" away, so the panel
  // stays light. The look in use is always in the page.
  const [search, setSearch] = useState<Record<string, string>>({});
  const [shown, setShown] = useState<Record<string, number>>({});
  const visibleOptions = (group: (typeof groups)[number]) => {
    const query = (search[group.id] ?? '').trim().toLowerCase();
    const matching = query
      ? group.options.filter((option) => `${option.label} ${option.note}`.toLowerCase().includes(query))
      : group.options;
    const limit = shown[group.id] ?? PAGE_SIZE;
    const page = matching.slice(0, limit);
    const selected = matching.find((option) => isSameTextStyle(current, option.choice));
    if (selected && !page.includes(selected)) page.unshift(selected);
    return { page, total: matching.length, rest: Math.max(0, matching.length - page.length) };
  };

  return (
    <div className="space-y-3" role="group" aria-label={t('Text style')}>
      <style dangerouslySetInnerHTML={{ __html: getOutlineFontFaceCss() }} />
      <span className={editorFieldLabelClassName}>{t('Style')}</span>
      {groups.map((group) => (
        <div key={group.id} className="space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-[var(--studio-ink)]">{group.title}</p>
              <p className="text-xs text-[var(--studio-ink-muted)]">{group.description}</p>
            </div>
            {group.id !== 'traced' && (
              <button
                type="button"
                aria-expanded={isOpen(group.id)}
                onClick={() => setOpened((set) => { const next = new Set(set); if (next.has(group.id)) next.delete(group.id); else next.add(group.id); return next; })}
                className="shrink-0 rounded-md border border-[var(--studio-border)] px-2 py-1 text-xs font-medium text-[var(--studio-ink-secondary)] hover:border-violet-400/50 focus:outline-none focus:ring-2 focus:ring-accent-400"
              >
                {isOpen(group.id) ? t('Hide') : t('Show {n}', { n: group.options.length })}
              </button>
            )}
          </div>
          {isOpen(group.id) && group.options.length > PAGE_SIZE && (
            <input
              type="search"
              value={search[group.id] ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                setSearch((all) => ({ ...all, [group.id]: value }));
                setShown((all) => ({ ...all, [group.id]: PAGE_SIZE }));
              }}
              placeholder={t('Search {n} styles', { n: group.options.length })}
              aria-label={t('Search styles')}
              className="w-full rounded-lg border border-[var(--studio-border)] bg-[var(--studio-well)] px-3 py-1.5 text-xs text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-accent-400"
            />
          )}
          {isOpen(group.id) && (
          <ul className="grid grid-cols-2 gap-2">
            {visibleOptions(group).page.map((option) => {
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
                    {option.choice.kind === 'outline' || option.choice.kind === 'dots' ? (
                      <OptionPicture option={option} text={text} />
                    ) : (
                      <WhenVisible placeholderClassName="h-12 w-full rounded bg-[var(--studio-hover-overlay)]">
                        <OptionPicture option={option} text={text} />
                      </WhenVisible>
                    )}
                    <span className="truncate text-xs font-medium">{option.label}</span>
                    <span className="truncate text-xs text-[var(--studio-ink-muted)]">{option.note}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          )}
          {isOpen(group.id) && visibleOptions(group).total === 0 && (
            <p className="text-xs text-[var(--studio-ink-muted)]">{t('No styles match')}</p>
          )}
          {isOpen(group.id) && visibleOptions(group).rest > 0 && (
            <button
              type="button"
              onClick={() => setShown((all) => ({ ...all, [group.id]: (all[group.id] ?? PAGE_SIZE) + PAGE_SIZE }))}
              className="w-full rounded-lg border border-[var(--studio-border)] px-3 py-1.5 text-xs font-medium text-[var(--studio-ink-secondary)] hover:border-violet-400/50 focus:outline-none focus:ring-2 focus:ring-accent-400"
            >
              {t('Show {n} more', { n: Math.min(PAGE_SIZE, visibleOptions(group).rest) })}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
