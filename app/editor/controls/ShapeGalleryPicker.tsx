'use client';

import { GALLERY_SHAPES, type GalleryShape } from '../../lib/shapeGallery';
import { editorFieldLabelClassName } from './controlStyles';

import { useT } from '../../lib/i18n';
/** Ready-made shapes to start from, for people who have no file yet. */
export default function ShapeGalleryPicker({ onPick, selectedName }: { onPick: (shape: GalleryShape) => void; selectedName?: string | null }) {
  const t = useT();
  return (
    <div className="space-y-2" role="group" aria-label={t('Ready-made shapes')}>
      <span className={editorFieldLabelClassName}>{t('Or start from a shape')}</span>
      <ul className="grid grid-cols-3 gap-1.5">
        {GALLERY_SHAPES.map((shape) => (
          <li key={shape.id}>
            <button
              type="button"
              onClick={() => onPick(shape)}
              aria-pressed={selectedName === shape.label}
              aria-label={shape.label}
              className={`flex w-full flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-xs transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${
                selectedName === shape.label
                  ? 'border-violet-500 bg-violet-500/10 text-[var(--studio-ink)]'
                  : 'border-[var(--studio-border)] bg-[var(--studio-well)] text-[var(--studio-ink-secondary)] hover:border-violet-400/50'
              }`}
            >
              {/* Our own constant SVG, never user input. */}
              <span aria-hidden="true" className="block h-9 w-9 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: shape.svg }} />
              <span>{shape.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
