'use client';

import { useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import type { ShapeRegion } from '@/src/lib/papercraft-engine';
import { useT } from '../lib/i18n';
import ShapeGalleryPicker from '../editor/controls/ShapeGalleryPicker';
import type { GalleryShape } from '../lib/shapeGallery';
import { NumberField, SelectField, Section } from './fields';
import { DEFAULT_SHAPE_SETTINGS, ShapeFileError, regionsFromSvg, shapeModel, SHAPE_LIMITS, type ShapeMode, type ShapeSettings } from './papercraftShapes';
import type { PapercraftAction, PapercraftState } from './papercraftState';

/** Make a model from a flat shape: pick one from the gallery or read an SVG file, then a box in that shape or the shape spun round. */
export default function ShapeSection({ source, dispatch }: { source: PapercraftState['source']; dispatch: React.Dispatch<PapercraftAction> }) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [regions, setRegions] = useState<ShapeRegion[] | null>(null);
  const [label, setLabel] = useState<string>('');
  const [settings, setSettings] = useState<ShapeSettings>(DEFAULT_SHAPE_SETTINGS);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // The file name of the model this panel made last: while it is still the model, a change updates it instead of starting a new design.
  const lastMade = useRef<string | null>(null);

  const make = (from: ShapeRegion[], name: string, next: ShapeSettings) => {
    const model = shapeModel(from, next);
    if (!model) {
      setError(t('There is nothing in this shape to build a model from.'));
      return;
    }
    setError(null);
    setNote(model.omittedPieces > 0 ? t('{count} separate pieces were left out: the biggest one is the model.', { count: model.omittedPieces }) : null);
    const fileName = `${name} (${next.mode === 'box' ? t('box') : t('spun')})`;
    if (source.kind === 'file' && source.fileName === lastMade.current) dispatch({ type: 'REPAIR_MESH', mesh: model.mesh });
    else dispatch({ type: 'USE_FILE', fileName, mesh: model.mesh });
    // The name follows the mode.
    if (source.kind === 'file' && source.fileName === lastMade.current) dispatch({ type: 'SET_NAME', name: fileName });
    lastMade.current = fileName;
  };

  const pickShape = (shape: GalleryShape) => {
    try {
      const from = regionsFromSvg(shape.svg);
      setRegions(from);
      setLabel(t(shape.label));
      make(from, t(shape.label), settings);
    } catch {
      setError(t('This file could not be read as a shape.'));
    }
  };

  const readFile = async (file: File) => {
    try {
      if (file.size > 2 * 1024 * 1024) throw new ShapeFileError('too-big');
      const from = regionsFromSvg(await file.text());
      const name = file.name.replace(/\.[^.]+$/, '') || t('Shape');
      setRegions(from);
      setLabel(name);
      make(from, name, settings);
    } catch (e) {
      setError(
        e instanceof ShapeFileError && e.code === 'too-big'
          ? t('That file is too big (over 2 MB). Use a simpler SVG.')
          : e instanceof ShapeFileError && e.code === 'empty'
            ? t('There is nothing in this shape to build a model from.')
            : t('This file could not be read as a shape.'),
      );
    }
  };

  const change = (patch: Partial<ShapeSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    if (regions) make(regions, label, next);
  };

  const l = SHAPE_LIMITS;
  return (
    <Section title={t('Make a model from a shape')} defaultOpen={false}>
      <p className="text-xs text-[var(--studio-ink-subtle)]">{t('Pick a flat shape. It becomes a box in that shape, or the shape is spun round like a vase.')}</p>
      <ShapeGalleryPicker onPick={pickShape} selectedName={regions ? label : null} label={t('Shapes')} />
      <input
        ref={fileRef}
        type="file"
        accept=".svg,image/svg+xml"
        className="sr-only"
        aria-label={t('Choose an SVG file')}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void readFile(file);
          event.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="flex w-full items-center gap-2 rounded-md border border-dashed border-[var(--studio-border-strong)] bg-[var(--studio-well)] px-2.5 py-2 text-left text-xs font-medium text-[var(--studio-ink-secondary)] hover:bg-[var(--studio-surface-hover)]"
      >
        <FileUp className="h-4 w-4 shrink-0 text-violet-300" aria-hidden="true" />
        {t('Use your own SVG file')}
      </button>
      <SelectField<ShapeMode>
        label={t('Make it')}
        value={settings.mode}
        options={[
          { value: 'box', label: t('A box in the shape') },
          { value: 'spun', label: t('The shape spun round') },
        ]}
        onChange={(mode) => change({ mode })}
      />
      {settings.mode === 'box' ? (
        <>
          <NumberField label={t('Corners')} value={settings.corners} min={l.corners.min} max={l.corners.max} onChange={(corners) => change({ corners })} />
          <NumberField label={t('Depth')} suffix="%" value={settings.depthPct} min={l.depthPct.min} max={l.depthPct.max} step={5} onChange={(depthPct) => change({ depthPct })} />
        </>
      ) : (
        <>
          <NumberField label={t('Rings')} value={settings.rings} min={l.rings.min} max={l.rings.max} onChange={(rings) => change({ rings })} />
          <NumberField label={t('Sides')} value={settings.sides} min={l.sides.min} max={l.sides.max} onChange={(sides) => change({ sides })} />
        </>
      )}
      {note && <p className="text-xs text-[var(--studio-ink-subtle)]">{note}</p>}
      {error && (
        <p role="alert" className="rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-[var(--studio-ink)]">
          {error}
        </p>
      )}
    </Section>
  );
}
