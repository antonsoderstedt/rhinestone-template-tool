'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, Gem, Star, SwatchBook } from 'lucide-react';
import type { StoneSizeId } from '@/src/lib/rhinestone-engine/index';
import { outlineFontThumbnail, type OutlineFontPreview } from '../editor/textStyleThumbnails';
import { WorkspaceTag, workspaceInputClassName, workspaceSelectClassName, workspaceTextAreaClassName } from '../components/workspace/WorkspaceChrome';
import { DEFAULT_PREVIEW_TEXT, buildFontLaunchUrl, getFontLaunchAvailability } from '../lib/fontLaunch';
import { useT } from '../lib/i18n';
import type { FontEntry, FontFamily } from './fontFamilies';

export const UPLOAD_FONT_CATEGORIES = ['Block', 'Condensed', 'Varsity', 'Bubble', 'Serif', 'Gothic', 'Script', 'Handwritten', 'Display'] as const;
const COVERAGE_DEFAULTS = [
  { value: 'outline', label: 'Outline default' },
  { value: 'fill', label: 'Fill default' },
  { value: 'outline-fill', label: 'Outline + fill default' },
] as const;

const SOURCE_LABELS = { bundled: 'Built-in', 'workspace-installed': 'Library', 'browser-uploaded': 'Yours' } as const;

/** The editable fields of a font the user uploaded. */
export type UploadedFontPatch = Partial<{ category: string; styleLabel: string; preferredTextCoverageMode: Exclude<FontEntry['preferredTextCoverageMode'], 'contour'>; licenseSource: string; note: string }>;

export interface FontCardProps {
  family: FontFamily;
  /** The variant shown (a font key). */
  selectedKey: string;
  onSelectVariant: (fontKey: string) => void;
  previewText: string;
  stones: { on: boolean; size: StoneSizeId };
  unavailable: (font: FontEntry) => boolean;
  onFavorite: (font: FontEntry) => void;
  /** Archives (or restores) the whole family. */
  onArchive: (family: FontFamily) => void;
  onTags: (font: FontEntry, tags: string[]) => void;
  onEditUploaded: (font: FontEntry, patch: UploadedFontPatch) => void;
  onLaunch: (url: string) => void;
}

/** The text traced in the font and drawn as stones. Made when the card is first on screen, and again when the text or size changes. */
function StonePreview({ fontId, text, size, onResult }: { fontId: string; text: string; size: StoneSizeId; onResult: (result: OutlineFontPreview | null) => void }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const [result, setResult] = useState<{ key: string; preview: OutlineFontPreview } | null>(null);
  const key = `${fontId}|${size}|${text}`;

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
    }, { rootMargin: '160px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [seen]);

  useEffect(() => {
    if (!seen) return undefined;
    let cancelled = false;
    // Wait until typing has paused, so each keystroke does not trace every font.
    const timer = window.setTimeout(() => {
      void outlineFontThumbnail(fontId, text, size).then((preview) => {
        if (cancelled) return;
        setResult({ key, preview });
        onResult(preview);
      });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [seen, fontId, text, size, key, onResult]);

  const ready = result && result.key === key ? result.preview : null;
  const thumbnail = ready?.thumbnail ?? null;
  return (
    <div ref={ref} className="flex h-full w-full items-center justify-center">
      {!ready && <div className="h-10 w-3/4 animate-pulse rounded bg-border/60" aria-label={t('Loading')} />}
      {ready && !thumbnail && <p className="text-sm text-ink-muted">{t('No preview')}</p>}
      {thumbnail && (
        <svg
          viewBox={`${thumbnail.viewBox.x} ${thumbnail.viewBox.y} ${thumbnail.viewBox.width} ${thumbnail.viewBox.height}`}
          className="h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={t('The text as stones')}
        >
          {thumbnail.dots.map((dot, index) => (
            <circle key={index} cx={dot.x} cy={dot.y} r={dot.r} className="fill-accent-600" />
          ))}
        </svg>
      )}
    </div>
  );
}

/**
 * Comma-separated tags. Keeps what is being typed (including trailing commas and
 * spaces) and saves on blur or Enter, so typing "a, b" is possible.
 */
export function TagsField({ fontName, tags, onCommit }: { fontName: string; tags: string[]; onCommit: (tags: string[]) => void }) {
  const t = useT();
  const [draft, setDraft] = useState(tags.join(', '));
  const commit = () => {
    const next = draft.split(',').map((tag) => tag.trim()).filter(Boolean);
    if (next.join('\u0000') !== tags.join('\u0000')) onCommit(next);
  };
  return (
    <div className="space-y-2 text-sm text-ink-secondary">
      <label className="block space-y-2">
        <span className="font-medium text-ink">{t('Tags')}</span>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
          }}
          aria-label={`Tags for ${fontName}, separated by commas`}
          placeholder="e.g. wedding, chrome, mascot"
          className={workspaceInputClassName}
        />
      </label>
      {tags.length > 0 && <div className="flex flex-wrap gap-2">{tags.map((tag) => <WorkspaceTag key={tag}>{tag}</WorkspaceTag>)}</div>}
    </div>
  );
}

export default function FontCard({ family, selectedKey, onSelectVariant, previewText, stones, unavailable, onFavorite, onArchive, onTags, onEditUploaded, onLaunch }: FontCardProps) {
  const t = useT();
  const font = family.variants.find((variant) => variant.key === selectedKey) ?? family.variants[0]!;
  const failed = unavailable(font);
  const text = previewText.trim() || DEFAULT_PREVIEW_TEXT;
  const availability = getFontLaunchAvailability({ isBuiltInSimple: font.isBuiltInSimple, fileUnavailable: failed });
  const [preview, setPreview] = useState<OutlineFontPreview | null>(null);
  const onResult = useMemo(() => (result: OutlineFontPreview | null) => setPreview(result), []);
  const editable = font.source === 'browser-uploaded';
  const showStones = stones.on && !font.isBuiltInSimple;

  const action = 'inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-ink transition disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <article className="flex flex-col rounded-2xl border border-border/80 bg-white/90 p-4 shadow-sm transition hover:border-border-strong hover:shadow-md">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
            {family.category === 'Legacy' ? t('Built-in') : family.category} · {t(SOURCE_LABELS[font.source])}
          </div>
          <h2 className="truncate text-lg font-semibold text-ink" title={family.name}>{family.name}</h2>
        </div>
        <button
          type="button"
          onClick={() => onFavorite(font)}
          aria-pressed={font.favorite}
          aria-label={font.favorite ? `Remove ${font.name} from favorites` : `Add ${font.name} to favorites`}
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${font.favorite ? 'bg-warning-50 text-warning-600' : 'bg-surface text-ink-muted hover:text-ink'}`}
        >
          <Star className="h-4 w-4" />
        </button>
      </header>

      <div className="mt-3 flex h-28 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface px-3">
        {failed ? (
          <p role="alert" className="text-center text-sm text-warning-600">
            {t('This font file could not be loaded, so it cannot be previewed or used. Re-download the font and upload it again.')}
          </p>
        ) : showStones ? (
          <StonePreview fontId={font.key} text={text} size={stones.size} onResult={onResult} />
        ) : (
          <p
            style={{ fontFamily: `'${font.previewFamily}', system-ui, sans-serif` }}
            className="max-h-full w-full break-words text-center text-4xl leading-tight text-ink"
          >
            {text}
          </p>
        )}
      </div>

      {showStones && preview && !failed && (
        <p className="mt-2 text-xs text-ink-muted">
          {preview.thumbnail ? t('{n} stones at {size}', { n: preview.stoneCount, size: stones.size }) : t('No preview')}
          {preview.missing.length > 0 && <span className="ml-2 text-warning-700">{t('Missing letters: {letters}', { letters: preview.missing.join(' ') })}</span>}
        </p>
      )}

      {family.variants.length > 1 && (
        <label className="mt-3 block text-xs text-ink-muted">
          <span className="sr-only">{t('Style')}</span>
          <select value={font.key} onChange={(event) => onSelectVariant(event.target.value)} className={workspaceSelectClassName} aria-label={`${t('Style')}: ${family.name}`}>
            {family.variants.map((variant) => (
              <option key={variant.key} value={variant.key}>{variant.variantName && variant.variantName !== 'Imported' ? variant.variantName : variant.name}</option>
            ))}
          </select>
        </label>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={!availability.rhinestone.enabled}
          title={availability.rhinestone.reason}
          onClick={() => onLaunch(buildFontLaunchUrl('rhinestone', font.key, text))}
          className={`${action} enabled:hover:border-accent-300 enabled:hover:text-accent-600`}
        >
          <Gem className="h-4 w-4" aria-hidden="true" />
          {t('Rhinestone')}
        </button>
        <button
          type="button"
          disabled={!availability.htv.enabled}
          title={availability.htv.reason}
          onClick={() => onLaunch(buildFontLaunchUrl('htv', font.key, text))}
          className={`${action} enabled:hover:border-brand-300 enabled:hover:text-brand-600`}
        >
          <SwatchBook className="h-4 w-4" aria-hidden="true" />
          {t('HTV')}
        </button>
      </div>

      <details className="mt-3 border-t border-border pt-3 text-sm">
        <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted hover:text-ink">{t('Details')}</summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs leading-5 text-ink-secondary">{font.note || font.licenseSource}</p>
          <TagsField key={`${font.key}:${font.tags.join('|')}`} fontName={font.name} tags={font.tags} onCommit={(tags) => onTags(font, tags)} />
          {editable && (
            <div className="grid gap-3">
              <label className="space-y-1 text-sm text-ink-secondary">
                <span className="font-medium text-ink">{t('Category')}</span>
                <select value={font.category} onChange={(event) => onEditUploaded(font, { category: event.target.value })} className={workspaceSelectClassName}>
                  {(UPLOAD_FONT_CATEGORIES as readonly string[]).includes(font.category) ? null : <option value={font.category}>{font.category}</option>}
                  {UPLOAD_FONT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm text-ink-secondary">
                <span className="font-medium text-ink">{t('Default text style')}</span>
                <select value={font.preferredTextCoverageMode} onChange={(event) => onEditUploaded(font, { preferredTextCoverageMode: event.target.value as Exclude<FontEntry['preferredTextCoverageMode'], 'contour'> })} className={workspaceSelectClassName}>
                  {COVERAGE_DEFAULTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm text-ink-secondary">
                <span className="font-medium text-ink">{t('License / source')}</span>
                <input value={font.licenseSource} onChange={(event) => onEditUploaded(font, { licenseSource: event.target.value })} className={workspaceInputClassName} />
              </label>
              <label className="space-y-1 text-sm text-ink-secondary">
                <span className="font-medium text-ink">{t('Production note')}</span>
                <textarea value={font.note} onChange={(event) => onEditUploaded(font, { note: event.target.value })} rows={3} className={workspaceTextAreaClassName} />
              </label>
            </div>
          )}
          {family.variants.every((variant) => !variant.isBuiltInSimple) && (
            <button type="button" onClick={() => onArchive(family)} className="inline-flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm font-medium text-ink-secondary transition hover:text-ink">
              <Archive className="h-4 w-4" aria-hidden="true" />
              {family.archived ? t('Restore') : t('Archive')}
            </button>
          )}
        </div>
      </details>
    </article>
  );
}
