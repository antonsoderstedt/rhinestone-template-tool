'use client';

import { useState, useMemo } from 'react';
import {
  createStoneGridTemplate,
  createRhinestoneTemplate,
  createEditHistory,
  addStoneToTemplate,
  removeStoneFromTemplate,
  commitEditedTemplate,
  undoEdit,
  redoEdit,
  createStoneAtPoint,
  checkExportReadiness,
  createBasicSvgExport,
  getTemplatePhysicalSize,
} from '@/src/lib/rhinestone-engine/index';
import type {
  StoneSizeId,
  TemplateEditHistory,
  ExportReadinessResult,
} from '@/src/lib/rhinestone-engine/index';
import SvgPreview from './SvgPreview';
import SvgExportActions from './SvgExportActions';
import TemplateStatsCard from './TemplateStatsCard';
import ExportReadinessPanel from './ExportReadinessPanel';
import { downloadProject } from '@/app/lib/projectUtils';
import type { ManualEditorProjectState, RhinestoneProjectFile } from '@/src/lib/rhinestone-engine/index';

// ─── Constants ────────────────────────────────────────────────────────────────

const STONE_SIZES: StoneSizeId[] = ['SS6', 'SS8', 'SS10', 'SS12'];

function makeDefaultTemplate() {
  return createStoneGridTemplate({
    id: 'manual-editor-default',
    name: 'Manual Editor SS10 5×3',
    stoneSize: 'SS10',
    columns: 5,
    rows: 3,
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Manual Stone Editor v1
 *
 * Editor logic lives entirely in the engine. This component only manages
 * React state and renders results — it never duplicates stone math.
 */
export default function ManualStoneEditor({ defaultState }: { defaultState?: ManualEditorProjectState } = {}) {
  const [history, setHistory] = useState<TemplateEditHistory>(() => {
    if (defaultState && defaultState.stones.length > 0) {
      const restored = createRhinestoneTemplate({
        id: 'manual-editor-restored',
        name: 'Restored Manual Editor',
        stones: defaultState.stones.map((s) => ({
          id: s.id,
          center: { x: s.x, y: s.y },
          stoneSize: s.stoneSize,
          holeDiameterMm: s.holeDiameterMm,
        })),
      });
      return createEditHistory(restored);
    }
    return createEditHistory(makeDefaultTemplate());
  });
  const [selectedStoneId, setSelectedStoneId] = useState<string | null>(null);
  const [addX, setAddX] = useState<number | ''>(20);
  const [addY, setAddY] = useState<number | ''>(20);
  const [addStoneSize, setAddStoneSize] = useState<StoneSizeId>('SS10');
  const [editError, setEditError] = useState<string | null>(null);
  const [includeGuideBox, setIncludeGuideBox] = useState(defaultState?.includeGuideBox ?? true);
  const [paddingMm, setPaddingMm] = useState(defaultState?.paddingMm ?? 5);

  const template = history.present;

  // ── Export state (SVG + readiness) ─────────────────────────────────────────
  type ExportState = {
    svg: string;
    readiness: ExportReadinessResult;
    widthMm: number;
    heightMm: number;
  };

  const exportState = useMemo<ExportState>(() => {
    const svg = createBasicSvgExport(template, {
      includeGuideBox,
      includeLabels: false,
      paddingMm,
      decimalPlaces: 3,
    });
    const readiness = checkExportReadiness(template, { requireCalibration: false });
    const { widthMm, heightMm } = getTemplatePhysicalSize(template);
    return { svg, readiness, widthMm, heightMm };
  }, [template, includeGuideBox, paddingMm]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleAddStone() {
    if (addX === '' || addY === '') return;
    setEditError(null);
    try {
      const stone = createStoneAtPoint({
        template,
        point: { x: Number(addX), y: Number(addY) },
        stoneSize: addStoneSize,
        idPrefix: 'manual',
      });
      const next = addStoneToTemplate(template, stone);
      setHistory((prev) => commitEditedTemplate(prev, next));
    } catch (err) {
      setEditError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleRemoveSelected() {
    if (!selectedStoneId) return;
    setEditError(null);
    const idToRemove = selectedStoneId;
    try {
      const next = removeStoneFromTemplate(template, idToRemove);
      setHistory((prev) => commitEditedTemplate(prev, next));
      setSelectedStoneId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleUndo() {
    setEditError(null);
    setHistory((prev) => undoEdit(prev));
    setSelectedStoneId(null);
  }

  function handleRedo() {
    setEditError(null);
    setHistory((prev) => redoEdit(prev));
    setSelectedStoneId(null);
  }

  function handleReset() {
    setEditError(null);
    setHistory(createEditHistory(makeDefaultTemplate()));
    setSelectedStoneId(null);
  }

  const filename = `rhinestone-manual-editor-ss10.svg`;

  function handleSaveProject() {
    const project: RhinestoneProjectFile = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      projectName: `Manual Editor — ${template.stones.length} stones`,
      generatorState: {
        generatorId: 'manual-editor',
        stones: template.stones.map((s) => ({
          id: s.id,
          x: s.center.x,
          y: s.center.y,
          stoneSize: s.stoneSize,
          holeDiameterMm: s.holeDiameterMm,
        })),
        includeGuideBox,
        paddingMm,
      },
    };
    downloadProject(project);
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Explanation ──────────────────────────────────────────────────── */}
      <div className="rounded-lg bg-zinc-50 border border-zinc-200 px-4 py-3 text-sm text-zinc-600 leading-relaxed">
        <strong>Manual Stone Editor v1</strong> — Add and remove individual stones from a template.
        Undo/redo supported. Drag, multi-select, and advanced editing will come in a future version.
      </div>

      {/* ── Undo / Redo / Reset ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleUndo}
          disabled={history.past.length === 0}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        >
          ↩ Undo
        </button>
        <button
          onClick={handleRedo}
          disabled={history.future.length === 0}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        >
          ↪ Redo
        </button>
        <span className="text-xs text-zinc-400 ml-2">
          {history.past.length} edit{history.past.length !== 1 ? 's' : ''}
          {history.future.length > 0 && ` · ${history.future.length} redo`}
        </span>
        <button
          onClick={handleReset}
          className="ml-auto rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        >
          Reset to default
        </button>
      </div>

      {/* ── Edit error ───────────────────────────────────────────────────── */}
      {editError && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <strong>Error:</strong> {editError}
        </div>
      )}

      {/* ── Stone list + Add form ─────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Stone list */}
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
            Stones ({template.stones.length})
          </p>
          <div className="h-52 overflow-y-auto border border-zinc-200 rounded divide-y divide-zinc-100">
            {template.stones.length === 0 && (
              <p className="px-3 py-8 text-zinc-400 text-center text-xs">No stones in template.</p>
            )}
            {template.stones.map((stone) => (
              <div
                key={stone.id}
                onClick={() => setSelectedStoneId((id) => (id === stone.id ? null : stone.id))}
                className={`px-3 py-1.5 cursor-pointer flex justify-between items-center text-sm ${
                  selectedStoneId === stone.id
                    ? 'bg-blue-50 text-blue-800'
                    : 'hover:bg-zinc-50 text-zinc-700'
                }`}
              >
                <span className="font-mono text-xs truncate">{stone.id}</span>
                <span className="text-xs text-zinc-400 ml-2 shrink-0">
                  ({stone.center.x.toFixed(1)}, {stone.center.y.toFixed(1)}) {stone.stoneSize}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={handleRemoveSelected}
            disabled={!selectedStoneId}
            className="mt-2 rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40 w-full focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            {selectedStoneId ? `Remove "${selectedStoneId}"` : 'Select a stone to remove'}
          </button>
        </div>

        {/* Add stone form */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Add Stone</p>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">X (mm)</span>
              <input
                type="number"
                step={0.5}
                value={addX}
                onChange={(e) => setAddX(e.target.value === '' ? '' : Number(e.target.value))}
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">Y (mm)</span>
              <input
                type="number"
                step={0.5}
                value={addY}
                onChange={(e) => setAddY(e.target.value === '' ? '' : Number(e.target.value))}
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Stone size</span>
            <select
              value={addStoneSize}
              onChange={(e) => setAddStoneSize(e.target.value as StoneSizeId)}
              className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              {STONE_SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          <button
            onClick={handleAddStone}
            disabled={addX === '' || addY === ''}
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 mt-auto focus:outline-none focus:ring-2 focus:ring-zinc-500"
          >
            + Add Stone
          </button>

          {/* Preview options */}
          <div className="border-t border-zinc-100 pt-3 flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              <input
                type="checkbox"
                checked={includeGuideBox}
                onChange={(e) => setIncludeGuideBox(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              Guide box
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              <span className="text-xs">Pad:</span>
              <input
                type="number"
                min={0}
                step={1}
                value={paddingMm}
                onChange={(e) => setPaddingMm(Math.max(0, Number(e.target.value)))}
                className="w-16 rounded border border-zinc-200 px-1.5 py-1 text-sm"
              />
              mm
            </label>
          </div>
        </div>
      </div>

      {/* ── Readiness + stats + preview + export ──────────────────────────── */}
      <ExportReadinessPanel result={exportState.readiness} />

      <TemplateStatsCard
        stoneCount={template.stones.length}
        extraStats={[
          { label: 'Est. width',  value: `${exportState.widthMm.toFixed(1)} mm`  },
          { label: 'Est. height', value: `${exportState.heightMm.toFixed(1)} mm` },
          { label: 'Edits',       value: history.past.length                      },
          { label: 'Redos avail', value: history.future.length                    },
        ]}
      />

      <SvgPreview svg={exportState.svg} title="Editor preview" />

      <SvgExportActions
        svg={exportState.svg}
        filename={filename}
        disabled={!exportState.readiness.ready}
      />

      {/* ── Save project ──────────────────────────────────────────────── */}
      <div className="border-t border-zinc-100 pt-4">
        <button
          onClick={handleSaveProject}
          className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        >
          Save project (.json)
        </button>
        <p className="mt-1 text-xs text-zinc-400">Saves current stone positions. Undo history is not included.</p>
      </div>

    </div>
  );
}
