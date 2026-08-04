'use client';

import { CopyPlus, DiamondMinus, Hand, Layers3, MoveHorizontal, MoveVertical, PenLine, Plus, ScanSearch, Sparkles, Type, Upload } from 'lucide-react';
import {
  createImportedTemplate,
  getOutlineFontDefinition,
  getPreferredRhinestoneFontStoneSize,
  getSupportedTextCoverageModes,
  getStoneSizeProfile,
  TRW_STONE_SIZE_CALIBRATION,
  listRhinestoneFonts,
  getRhinestoneFontDefinition,
  getSupportedRhinestoneFontStoneSizes,
  listSvgAlphabets,
  getSvgAlphabetDefinition,
} from '@/src/lib/rhinestone-engine/index';
import { EditorTool, EditorState, EditorAction } from './EditorState';
import StoneProfileControl from './controls/StoneProfileControl';
import DensityControl from './controls/DensityControl';
import PhysicalDimensionsControl from './controls/PhysicalDimensionsControl';
import NumericInput from './controls/NumericInput';
import AdvancedSection from './controls/AdvancedSection';
import FillModeControl from './controls/FillModeControl';
import FontPicker, { type OutlineFontStatus } from './controls/FontPicker';
import PlacementModeControl from './controls/PlacementModeControl';
import { getEditableStatusCopy, getSelectionActionState, getSelectionEmptyState, getSourcePanelTool, type SourcePanelTool } from './editorUi';
import { getGeneratorCapabilityProfile } from '@/src/lib/rhinestone-engine/index';

interface EditorPropertiesPanelProps {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  mode?: 'combined' | 'source' | 'inspector';
  outlineFontStatus?: OutlineFontStatus;
}

const SOURCE_TOOL_CONFIG: Array<{ id: SourcePanelTool; label: string; description: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'text', label: 'Text', description: 'Outline or dot-matrix text', icon: Type },
  { id: 'rhinestone-font', label: 'Stone Font', description: 'Pre-placed stones from a rhinestone font', icon: Type },
  { id: 'svg-alphabet', label: 'Alphabet', description: 'Compose text from a per-letter SVG alphabet', icon: Type },
  { id: 'letter-stencil', label: 'Stencils', description: 'Reusable per-letter stencil cards to spell words', icon: Type },
  { id: 'svg', label: 'Artwork', description: 'Upload SVG or image artwork', icon: Upload },
  { id: 'template-import', label: 'Import Template', description: 'Keep stones from an existing SVG template', icon: Upload },
  { id: 'grid', label: 'Grid', description: 'Build an even stone grid', icon: Layers3 },
  { id: 'manual', label: 'Manual', description: 'Place stones directly', icon: Plus },
];

function PanelSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {description && <p className="mt-1 text-xs text-zinc-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function SourceSwitcher({ activeTool, dispatch }: { activeTool: SourcePanelTool; dispatch: React.Dispatch<EditorAction> }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {SOURCE_TOOL_CONFIG.map((tool) => {
        const Icon = tool.icon;
        return (
          <button
            key={tool.id}
            onClick={() => dispatch({ type: 'SET_ACTIVE_TOOL', tool: tool.id })}
            className={`rounded-xl border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-purple-500 ${activeTool === tool.id ? 'border-purple-500/50 bg-purple-500/15 text-white' : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'}`}
            title={tool.description}
          >
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <span className="text-sm font-medium">{tool.label}</span>
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">{tool.description}</p>
          </button>
        );
      })}
    </div>
  );
}

export default function EditorPropertiesPanel({ state, dispatch, mode = 'combined', outlineFontStatus }: EditorPropertiesPanelProps) {
  const { activeTool } = state;

  if (mode === 'source') {
    const sourceTool = getSourcePanelTool(state);
    const statusCopy = getEditableStatusCopy(state.editableTemplate.isEditable);
    return (
      <aside className="w-[320px] min-w-[320px] border-r border-zinc-800 bg-zinc-950/70 p-4">
        <div className="flex h-full flex-col gap-4 overflow-y-auto">
          <PanelSection title="Design Source" description="Choose what drives the current template before you fine-tune individual stones.">
            <SourceSwitcher activeTool={sourceTool} dispatch={dispatch} />
          </PanelSection>

          <PanelSection title={statusCopy.label} description={statusCopy.description}>
            <div className={`rounded-xl border px-3 py-3 ${state.editableTemplate.isEditable ? 'border-blue-500/30 bg-blue-500/10 text-blue-100' : 'border-purple-500/30 bg-purple-500/10 text-purple-100'}`}>
              <div className="flex items-center gap-2 text-sm font-medium">
                {state.editableTemplate.isEditable ? <PenLine className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                <span>{statusCopy.label}</span>
              </div>
              <p className="mt-2 text-xs text-zinc-300">{statusCopy.actionHint}</p>
            </div>
          </PanelSection>

          <PanelSection title={getToolTitle(sourceTool)} description="These settings control the generated baseline for the current design source.">
            {sourceTool === 'text' && <TextToolProperties state={state} dispatch={dispatch} outlineFontStatus={outlineFontStatus} />}
            {sourceTool === 'rhinestone-font' && <RhinestoneFontToolProperties state={state} dispatch={dispatch} />}
            {sourceTool === 'svg-alphabet' && <SvgAlphabetToolProperties state={state} dispatch={dispatch} />}
            {sourceTool === 'letter-stencil' && <LetterStencilToolProperties state={state} dispatch={dispatch} />}
            {sourceTool === 'svg' && <SvgToolProperties state={state} dispatch={dispatch} />}
            {sourceTool === 'template-import' && <TemplateImportToolProperties state={state} dispatch={dispatch} />}
            {sourceTool === 'grid' && <GridToolProperties state={state} dispatch={dispatch} />}
            {sourceTool === 'manual' && <ManualToolProperties state={state} dispatch={dispatch} />}
          </PanelSection>
        </div>
      </aside>
    );
  }

  if (mode === 'inspector') {
    return (
      <aside className="w-[336px] min-w-[336px] border-l border-zinc-800 bg-zinc-950/70 p-4">
        <div className="flex h-full flex-col gap-4 overflow-y-auto">
          <PanelSection title="Inspector" description="Selection, position, alignment, and export controls live here.">
            <SelectToolProperties state={state} dispatch={dispatch} />
          </PanelSection>

          <PanelSection title="Export Settings" description="These options affect only the exported SVG output.">
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={state.includeGuideBox}
                onChange={(e) => dispatch({ type: 'UPDATE_EXPORT_SETTINGS', updates: { includeGuideBox: e.target.checked } })}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-800"
              />
              Include guide box
            </label>

            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={state.includeLabels}
                onChange={(e) => dispatch({ type: 'UPDATE_EXPORT_SETTINGS', updates: { includeLabels: e.target.checked } })}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-800"
              />
              Include labels
            </label>

            <NumericInput
              label="Padding"
              value={state.paddingMm}
              onChange={(val) => dispatch({ type: 'UPDATE_EXPORT_SETTINGS', updates: { paddingMm: typeof val === 'number' ? val : state.paddingMm } })}
              unit="mm"
              min={0}
              max={100}
              step={0.5}
            />
          </PanelSection>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 border-l border-zinc-700 bg-zinc-900 overflow-y-auto">
      <div className="p-4">
        <h2 className="text-sm font-semibold text-white mb-4">
          {getToolTitle(activeTool)}
        </h2>

        {activeTool === 'text' && <TextToolProperties state={state} dispatch={dispatch} />}
        {activeTool === 'rhinestone-font' && <RhinestoneFontToolProperties state={state} dispatch={dispatch} />}
        {activeTool === 'svg-alphabet' && <SvgAlphabetToolProperties state={state} dispatch={dispatch} />}
        {activeTool === 'letter-stencil' && <LetterStencilToolProperties state={state} dispatch={dispatch} />}
        {activeTool === 'svg' && <SvgToolProperties state={state} dispatch={dispatch} />}
        {activeTool === 'template-import' && <TemplateImportToolProperties state={state} dispatch={dispatch} />}
        {activeTool === 'grid' && <GridToolProperties state={state} dispatch={dispatch} />}
        {activeTool === 'manual' && <ManualToolProperties state={state} dispatch={dispatch} />}
        {activeTool === 'select' && <SelectToolProperties state={state} dispatch={dispatch} />}

        {/* Global Export Settings */}
        <div className="mt-6 pt-6 border-t border-zinc-700">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
            Export Settings
          </h3>
          
          <label className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={state.includeGuideBox}
              onChange={(e) => dispatch({ type: 'UPDATE_EXPORT_SETTINGS', updates: { includeGuideBox: e.target.checked } })}
              className="h-3.5 w-3.5 rounded"
            />
            <span className="text-sm text-zinc-300">Include guide box</span>
          </label>

          <label className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              checked={state.includeLabels}
              onChange={(e) => dispatch({ type: 'UPDATE_EXPORT_SETTINGS', updates: { includeLabels: e.target.checked } })}
              className="h-3.5 w-3.5 rounded"
            />
            <span className="text-sm text-zinc-300">Include labels</span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-400">Padding (mm)</span>
            <input
              type="number"
              min={0}
              step={0.5}
              value={state.paddingMm}
              onChange={(e) => dispatch({ type: 'UPDATE_EXPORT_SETTINGS', updates: { paddingMm: Number(e.target.value) } })}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </label>
        </div>
      </div>
    </aside>
  );
}

// ─── Tool-Specific Property Panels ───────────────────────────────────────────

function TextToolProperties({ state, dispatch, outlineFontStatus }: EditorPropertiesPanelProps) {
  const { textTool } = state;
  const textCapabilities = getGeneratorCapabilityProfile('outline-text');
  const selectedFontDefinition = getOutlineFontDefinition(textTool.fontId);
  const supportedCoverageModes = textTool.mode === 'outline'
    ? getSupportedTextCoverageModes(textTool.fontId)
    : ['outline'];
  const visibleCoverageModes = (() => {
    const modes: Array<'outline' | 'fill' | 'outline-fill' | 'contour'> = [];
    if (textTool.mode !== 'outline') {
      modes.push('outline');
      return modes;
    }

    for (const mode of supportedCoverageModes) {
      if (mode === 'contour') {
        modes.push(mode);
        continue;
      }
      if (textTool.outlineTextStyle === 'outline' && mode === 'outline') {
        modes.push(mode);
        continue;
      }
      if (textTool.outlineTextStyle === 'filled-typography' && (mode === 'fill' || mode === 'outline-fill')) {
        modes.push(mode);
      }
    }

    return modes;
  })();
  const fillModes = supportedCoverageModes.filter(
    (mode): mode is 'outline' | 'fill' | 'outline-fill' => mode !== 'contour',
  );
  const visibleFillModes = fillModes.filter((mode) => {
    if (textTool.outlineTextStyle === 'outline') return mode === 'outline';
    return mode === 'fill' || mode === 'outline-fill';
  });

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { mode: 'outline' } })}
          className={`flex-1 px-3 py-2 text-xs font-medium rounded transition ${
            textTool.mode === 'outline'
              ? 'bg-purple-600 text-white'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          Outline
        </button>
        <button
          onClick={() => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { mode: 'dot-matrix' } })}
          className={`flex-1 px-3 py-2 text-xs font-medium rounded transition ${
            textTool.mode === 'dot-matrix'
              ? 'bg-purple-600 text-white'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          Dot Matrix
        </button>
      </div>

      {/* Text Input */}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-400">Text</span>
        <textarea
          value={textTool.text}
          onChange={(e) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { text: e.target.value } })}
          rows={3}
          placeholder="Enter text..."
          className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
        />
      </label>

      {textTool.mode === 'outline' && outlineFontStatus && (
        <FontPicker
          value={textTool.fontId}
          previewText={textTool.text}
          status={outlineFontStatus}
          onChange={(fontId) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { fontId } })}
        />
      )}

      {textTool.mode === 'outline' && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-zinc-400">Text style</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { outlineTextStyle: 'outline' } })}
              className={`rounded-xl border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                textTool.outlineTextStyle === 'outline'
                  ? 'border-purple-500/50 bg-purple-500/15 text-white'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'
              }`}
            >
              <div className="text-sm font-medium">Outline text</div>
              <p className="mt-1 text-[11px] text-zinc-500">Follow the letter contours only.</p>
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { outlineTextStyle: 'filled-typography' } })}
              disabled={!fillModes.includes('fill')}
              className={`rounded-xl border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                textTool.outlineTextStyle === 'filled-typography'
                  ? 'border-purple-500/50 bg-purple-500/15 text-white'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'
              } ${!fillModes.includes('fill') ? 'cursor-not-allowed opacity-50 hover:border-zinc-800 hover:bg-zinc-950' : ''}`}
            >
              <div className="text-sm font-medium">Filled typography</div>
              <p className="mt-1 text-[11px] text-zinc-500">Fill thicker letters with a stone pattern.</p>
            </button>
          </div>
        </div>
      )}

      {textTool.mode === 'outline' && selectedFontDefinition.supportedTextCoverageModes.length === 1 && !selectedFontDefinition.isLegacy && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs text-amber-100">
          {selectedFontDefinition.displayName} is currently limited to outline placement to avoid poor filled text results.
        </div>
      )}

      {/* Stone Size */}
      <StoneProfileControl
        value={textTool.stoneSize}
        onChange={(size) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { stoneSize: size } })}
      />

      {/* Outline-specific controls */}
      {textTool.mode === 'outline' && (
        <>
          <NumericInput
            label="Font Size"
            value={textTool.fontSizeMm}
            onChange={(val) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { fontSizeMm: val } })}
            unit="mm"
            min={5}
            max={200}
            step={1}
          />

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-400">Alignment</span>
            <select
              value={textTool.align}
              onChange={(e) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { align: e.target.value as 'left' | 'center' | 'right' } })}
              className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>

          <NumericInput
            label="Letter Spacing"
            value={textTool.letterSpacingMm}
            onChange={(val) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { letterSpacingMm: val } })}
            unit="mm"
            min={0}
            max={50}
            step={0.5}
          />

          <NumericInput
            label="Line Spacing"
            value={textTool.lineSpacingMm}
            onChange={(val) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { lineSpacingMm: val } })}
            unit="mm"
            min={0}
            max={100}
            step={1}
          />
        </>
      )}

      {/* Dot-matrix-specific controls */}
      {textTool.mode === 'dot-matrix' && (
        <>
          <NumericInput
            label="Letter Spacing"
            value={textTool.letterSpacingColumns}
            onChange={(val) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { letterSpacingColumns: typeof val === 'number' ? val : 0 } })}
            unit="cols"
            min={0}
            max={10}
            step={1}
          />

          <NumericInput
            label="Line Spacing"
            value={textTool.lineSpacingRows}
            onChange={(val) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { lineSpacingRows: typeof val === 'number' ? val : 0 } })}
            unit="rows"
            min={0}
            max={10}
            step={1}
          />
        </>
      )}

      {/* Target Dimensions */}
      <PhysicalDimensionsControl
        widthMm={textTool.targetWidthMm}
        heightMm={textTool.targetHeightMm}
        preserveAspectRatio={textTool.preserveAspectRatio}
        onWidthChange={(val) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { targetWidthMm: val } })}
        onHeightChange={(val) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { targetHeightMm: val } })}
        onPreserveAspectRatioChange={(val) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { preserveAspectRatio: val } })}
      />

      {/* Density */}
      <DensityControl
        densityPreset={textTool.densityPreset}
        customSpacingMm={textTool.customSpacingMm}
        onDensityChange={(preset) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { densityPreset: preset } })}
        onCustomSpacingChange={(val) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { customSpacingMm: val } })}
      />

      {/* Advanced */}
      <AdvancedSection>
        <PlacementModeControl
          coverageMode={textTool.coverageMode}
          availableCoverageModes={visibleCoverageModes}
          placementPattern={textTool.placementPattern}
          availablePlacementPatterns={textCapabilities.supportedPlacementPatterns.filter((pattern): pattern is 'default' | 'hexagonal' | 'radial' => pattern === 'default' || pattern === 'hexagonal' || pattern === 'radial')}
          contourSettings={textTool.contourSettings}
          radialSettings={textTool.radialSettings}
          onCoverageModeChange={(coverageMode) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { coverageMode } })}
          onPlacementPatternChange={(placementPattern) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { placementPattern } })}
          onContourSettingsChange={(contourSettings) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { contourSettings } })}
          onRadialSettingsChange={(radialSettings) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { radialSettings } })}
        />
        <FillModeControl
          fillMode={textTool.fillMode}
          fillPattern={textTool.fillPattern}
          availableModes={visibleFillModes}
          availablePatterns={textCapabilities.supportedFillPatterns}
          onFillModeChange={(mode) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { fillMode: mode } })}
          onFillPatternChange={(pattern) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { fillPattern: pattern } })}
        />
      </AdvancedSection>
    </div>
  );
}

function RhinestoneFontToolProperties({ state, dispatch }: EditorPropertiesPanelProps) {
  const { rhinestoneFontTool } = state;
  const availableFonts = listRhinestoneFonts();
  const selectedFontDefinition = getRhinestoneFontDefinition(rhinestoneFontTool.rhinestoneFontId as never);
  const supportedStoneSizes = getSupportedRhinestoneFontStoneSizes(rhinestoneFontTool.rhinestoneFontId);
  const getStoneDiameterLabel = (size: typeof rhinestoneFontTool.stoneSize) => {
    return size in TRW_STONE_SIZE_CALIBRATION
      ? TRW_STONE_SIZE_CALIBRATION[size as keyof typeof TRW_STONE_SIZE_CALIBRATION].diameterMm
      : null;
  };
  const calibration = TRW_STONE_SIZE_CALIBRATION[
    rhinestoneFontTool.stoneSize as keyof typeof TRW_STONE_SIZE_CALIBRATION
  ];
  const modeCopy = rhinestoneFontTool.presentationMode === 'line'
    ? 'Line-style rhinestone font using pre-placed stones. This is the bridge to a future centerline workflow.'
    : rhinestoneFontTool.presentationMode === 'digits'
      ? 'Digits-focused rhinestone font using pre-placed stones. Best for numbers and scoreboards.'
      : 'Uses the stones already placed inside the selected rhinestone font. It does not trace letter outlines or generate a new grid.';

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-3 text-xs text-purple-100">
        {modeCopy}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-400">Rhinestone font</span>
        <select
          aria-label="Rhinestone font"
          value={rhinestoneFontTool.rhinestoneFontId}
          onChange={(e) => dispatch({
            type: 'UPDATE_RHINESTONE_FONT_TOOL',
            updates: {
              rhinestoneFontId: e.target.value,
              stoneSize: getPreferredRhinestoneFontStoneSize(e.target.value),
            },
          })}
          className="rounded border border-zinc-700 bg-zinc-800 px-2 py-2 text-sm text-white"
        >
          {availableFonts.map((font) => (
            <option key={font.fontId} value={font.fontId}>
              {font.displayName} — {font.style}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-zinc-500">
          {selectedFontDefinition.category} · {selectedFontDefinition.style} · mode {rhinestoneFontTool.presentationMode} · supports {supportedStoneSizes.join(', ')}
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-400">Text</span>
        <div className="flex items-center justify-between gap-3 text-[11px] text-zinc-500">
          <span>Suggested sample: {selectedFontDefinition.suggestedText}</span>
          <button
            type="button"
            onClick={() => dispatch({
              type: 'UPDATE_RHINESTONE_FONT_TOOL',
              updates: { text: selectedFontDefinition.suggestedText },
            })}
            className="rounded-full border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
          >
            Use sample
          </button>
        </div>
        <textarea
          aria-label="Rhinestone font text"
          value={rhinestoneFontTool.text}
          onChange={(e) => dispatch({
            type: 'UPDATE_RHINESTONE_FONT_TOOL',
            updates: { text: e.target.value },
          })}
          rows={3}
          placeholder={selectedFontDefinition.suggestedText}
          className="resize-y rounded border border-zinc-700 bg-zinc-800 px-2 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-400">Stone size</span>
        <select
          aria-label="Rhinestone font stone size"
          value={rhinestoneFontTool.stoneSize}
          onChange={(e) => dispatch({
            type: 'UPDATE_RHINESTONE_FONT_TOOL',
            updates: { stoneSize: e.target.value as typeof rhinestoneFontTool.stoneSize },
          })}
          className="rounded border border-zinc-700 bg-zinc-800 px-2 py-2 text-sm text-white"
        >
          {supportedStoneSizes.map((size) => (
            <option key={size} value={size}>
              {size}{getStoneDiameterLabel(size) !== null ? ` — ${getStoneDiameterLabel(size)} mm` : ''}
            </option>
          ))}
        </select>
        {calibration && (
          <span className="text-[11px] text-zinc-500">
            Authoritative hole diameter: {calibration.diameterMm} mm
          </span>
        )}
        {selectedFontDefinition.limitations && selectedFontDefinition.limitations.length > 0 && (
          <span className="text-[11px] text-zinc-500">
            {selectedFontDefinition.limitations.join(' · ')}
          </span>
        )}
        {selectedFontDefinition.style === 'Digits' && (
          <span className="text-[11px] text-zinc-500">
            Best for numeric-only designs.
          </span>
        )}
        {selectedFontDefinition.style === 'Line' && (
          <span className="text-[11px] text-zinc-500">
            Line-style rhinestone font. Candidate for a future centerline workflow.
          </span>
        )}
      </label>

      <NumericInput
        label="Letter spacing"
        value={rhinestoneFontTool.letterSpacingMm}
        onChange={(value) => dispatch({
          type: 'UPDATE_RHINESTONE_FONT_TOOL',
          updates: { letterSpacingMm: value },
        })}
        unit="mm"
        min={0}
        max={50}
        step={0.25}
      />

      <NumericInput
        label="Line spacing"
        value={rhinestoneFontTool.lineSpacingMm}
        onChange={(value) => dispatch({
          type: 'UPDATE_RHINESTONE_FONT_TOOL',
          updates: { lineSpacingMm: value },
        })}
        unit="mm"
        min={0}
        max={100}
        step={0.5}
      />

      {rhinestoneFontTool.unsupportedCharacters.length > 0 && (
        <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs text-amber-100">
          Unsupported characters: {rhinestoneFontTool.unsupportedCharacters.join(', ')}.
          They remain in the saved original text but do not generate stones.
        </div>
      )}
      {rhinestoneFontTool.presentationMode === 'digits' && /[A-Za-z]/.test(rhinestoneFontTool.text) && (
        <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs text-amber-100">
          This font is optimized for digits. Letter input may be unsupported or incomplete.
        </div>
      )}
    </div>
  );
}

function SvgAlphabetToolProperties({ state, dispatch }: EditorPropertiesPanelProps) {
  const { svgAlphabetTool } = state;
  const availableAlphabets = listSvgAlphabets();
  const selectedAlphabet = getSvgAlphabetDefinition(svgAlphabetTool.svgAlphabetId as never);
  const supportedStoneSizes = selectedAlphabet.supportedTargetStoneSizeIds;
  const calibration = TRW_STONE_SIZE_CALIBRATION[
    svgAlphabetTool.stoneSize as keyof typeof TRW_STONE_SIZE_CALIBRATION
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-3 text-xs text-purple-100">
        Composes text from a curated SVG alphabet where each letter is a separate glyph SVG. The engine reuses the letters as-is — no fill or outline pass runs.
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-400">Alphabet</span>
        <select
          aria-label="SVG alphabet"
          value={svgAlphabetTool.svgAlphabetId}
          onChange={(e) => {
            const next = getSvgAlphabetDefinition(e.target.value as never);
            dispatch({
              type: 'UPDATE_SVG_ALPHABET_TOOL',
              updates: {
                svgAlphabetId: next.alphabetId,
                stoneSize: next.supportedTargetStoneSizeIds[0] ?? 'SS10',
              },
            });
          }}
          className="rounded border border-zinc-700 bg-zinc-800 px-2 py-2 text-sm text-white"
        >
          {availableAlphabets.map((alphabet) => (
            <option key={alphabet.alphabetId} value={alphabet.alphabetId}>
              {alphabet.displayName} — {alphabet.style}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-zinc-500">
          {selectedAlphabet.category} · {selectedAlphabet.style} · supports {supportedStoneSizes.join(', ')}
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-400">Text</span>
        <div className="flex items-center justify-between gap-3 text-[11px] text-zinc-500">
          <span>Suggested sample: {selectedAlphabet.suggestedText}</span>
          <button
            type="button"
            onClick={() => dispatch({
              type: 'UPDATE_SVG_ALPHABET_TOOL',
              updates: { text: selectedAlphabet.suggestedText },
            })}
            className="rounded-full border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
          >
            Use sample
          </button>
        </div>
        <textarea
          aria-label="SVG alphabet text"
          value={svgAlphabetTool.text}
          onChange={(e) => dispatch({
            type: 'UPDATE_SVG_ALPHABET_TOOL',
            updates: { text: e.target.value },
          })}
          rows={3}
          placeholder={selectedAlphabet.suggestedText}
          className="resize-y rounded border border-zinc-700 bg-zinc-800 px-2 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-400">Stone size</span>
        <select
          aria-label="SVG alphabet stone size"
          value={svgAlphabetTool.stoneSize}
          onChange={(e) => dispatch({
            type: 'UPDATE_SVG_ALPHABET_TOOL',
            updates: { stoneSize: e.target.value as typeof svgAlphabetTool.stoneSize },
          })}
          className="rounded border border-zinc-700 bg-zinc-800 px-2 py-2 text-sm text-white"
        >
          {supportedStoneSizes.map((size) => (
            <option key={size} value={size}>
              {size}{size in TRW_STONE_SIZE_CALIBRATION ? ` — ${TRW_STONE_SIZE_CALIBRATION[size as keyof typeof TRW_STONE_SIZE_CALIBRATION].diameterMm} mm` : ''}
            </option>
          ))}
        </select>
        {calibration && (
          <span className="text-[11px] text-zinc-500">
            Authoritative hole diameter: {calibration.diameterMm} mm
          </span>
        )}
        {selectedAlphabet.limitations && selectedAlphabet.limitations.length > 0 && (
          <span className="text-[11px] text-zinc-500">
            {selectedAlphabet.limitations.join(' · ')}
          </span>
        )}
      </label>

      <NumericInput
        label="Letter spacing"
        value={svgAlphabetTool.letterSpacingMm}
        onChange={(value) => dispatch({
          type: 'UPDATE_SVG_ALPHABET_TOOL',
          updates: { letterSpacingMm: value },
        })}
        unit="mm"
        min={0}
        max={50}
        step={0.25}
      />

      <NumericInput
        label="Line spacing"
        value={svgAlphabetTool.lineSpacingMm}
        onChange={(value) => dispatch({
          type: 'UPDATE_SVG_ALPHABET_TOOL',
          updates: { lineSpacingMm: value },
        })}
        unit="mm"
        min={0}
        max={100}
        step={0.5}
      />

      {svgAlphabetTool.unsupportedCharacters.length > 0 && (
        <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs text-amber-100">
          Unsupported characters: {svgAlphabetTool.unsupportedCharacters.join(', ')}
        </div>
      )}
    </div>
  );
}

function LetterStencilToolProperties({ state, dispatch }: EditorPropertiesPanelProps) {
  const { letterStencilTool } = state;
  const availableAlphabets = listSvgAlphabets();
  const availableFonts = listRhinestoneFonts();
  const selectedAlphabet = getSvgAlphabetDefinition(letterStencilTool.svgAlphabetId as never);
  const selectedFont = getRhinestoneFontDefinition(letterStencilTool.rhinestoneFontId as never);
  const activeSource = letterStencilTool.sourceType === 'rhinestone-font'
    ? {
        displayName: selectedFont.displayName,
        category: selectedFont.category,
        style: selectedFont.style,
        supportedStoneSizes: selectedFont.supportedTargetStoneSizeIds,
        suggestedText: selectedFont.suggestedText,
      }
    : {
        displayName: selectedAlphabet.displayName,
        category: selectedAlphabet.category,
        style: selectedAlphabet.style,
        supportedStoneSizes: selectedAlphabet.supportedTargetStoneSizeIds,
        suggestedText: selectedAlphabet.suggestedText,
      };
  const calibration = TRW_STONE_SIZE_CALIBRATION[
    letterStencilTool.stoneSize as keyof typeof TRW_STONE_SIZE_CALIBRATION
  ];
  const supportedStoneSizes = activeSource.supportedStoneSizes;
  const cardCount = letterStencilTool.text.replace(/[\s\n]/g, '').length;
  const modeCopy = letterStencilTool.layoutMode === 'preview'
    ? 'Preview mode places cards edge-to-edge so you can read the assembled word. Use this for on-screen layout only, not as the final Cricut cut file.'
    : 'Cut-sheet mode keeps an equal-height frame around every letter and inserts a cut gap between cards — this is the layout you send to Cricut.';

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-3 text-xs text-purple-100">
        Generates a reusable stencil card per letter with an outer cut frame. I stays narrow, W stays wide, and every card keeps the same height so the machine cuts the card and the rhinestone holes together.
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-400">Glyph source</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => dispatch({
              type: 'UPDATE_LETTER_STENCIL_TOOL',
              updates: {
                sourceType: 'svg-alphabet',
                stoneSize: selectedAlphabet.supportedTargetStoneSizeIds[0] ?? 'SS10',
              },
            })}
            className={`rounded-xl border px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-purple-500 ${letterStencilTool.sourceType === 'svg-alphabet' ? 'border-purple-500/50 bg-purple-500/15 text-white' : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'}`}
          >
            <div className="font-medium">SVG Alphabet</div>
            <div className="mt-1 text-[10px] text-zinc-500">Curated per-letter SVG glyphs</div>
          </button>
          <button
            type="button"
            onClick={() => dispatch({
              type: 'UPDATE_LETTER_STENCIL_TOOL',
              updates: {
                sourceType: 'rhinestone-font',
                stoneSize: selectedFont.supportedTargetStoneSizeIds[0] ?? 'SS10',
              },
            })}
            className={`rounded-xl border px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-purple-500 ${letterStencilTool.sourceType === 'rhinestone-font' ? 'border-purple-500/50 bg-purple-500/15 text-white' : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'}`}
          >
            <div className="font-medium">Rhinestone Font</div>
            <div className="mt-1 text-[10px] text-zinc-500">Any registered OpenType rhinestone font</div>
          </button>
        </div>
      </div>

      {letterStencilTool.sourceType === 'svg-alphabet' ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-400">Alphabet</span>
          <select
            aria-label="Stencil alphabet"
            value={letterStencilTool.svgAlphabetId}
            onChange={(e) => {
              const next = getSvgAlphabetDefinition(e.target.value as never);
              dispatch({
                type: 'UPDATE_LETTER_STENCIL_TOOL',
                updates: {
                  svgAlphabetId: next.alphabetId,
                  stoneSize: next.supportedTargetStoneSizeIds[0] ?? 'SS10',
                },
              });
            }}
            className="rounded border border-zinc-700 bg-zinc-800 px-2 py-2 text-sm text-white"
          >
            {availableAlphabets.map((alphabet) => (
              <option key={alphabet.alphabetId} value={alphabet.alphabetId}>
                {alphabet.displayName} — {alphabet.style}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-zinc-500">
            {selectedAlphabet.category} · {selectedAlphabet.style} · supports {selectedAlphabet.supportedTargetStoneSizeIds.join(', ')}
          </span>
        </label>
      ) : (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-400">Rhinestone font</span>
          <select
            aria-label="Stencil rhinestone font"
            value={letterStencilTool.rhinestoneFontId}
            onChange={(e) => {
              const next = getRhinestoneFontDefinition(e.target.value as never);
              dispatch({
                type: 'UPDATE_LETTER_STENCIL_TOOL',
                updates: {
                  rhinestoneFontId: next.fontId,
                  stoneSize: next.supportedTargetStoneSizeIds[0] ?? 'SS10',
                },
              });
            }}
            className="rounded border border-zinc-700 bg-zinc-800 px-2 py-2 text-sm text-white"
          >
            {availableFonts.map((font) => (
              <option key={font.fontId} value={font.fontId}>
                {font.displayName} — {font.style}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-zinc-500">
            {selectedFont.category} · {selectedFont.style} · supports {selectedFont.supportedTargetStoneSizeIds.join(', ')}
          </span>
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-400">Text</span>
        <div className="flex items-center justify-between gap-3 text-[11px] text-zinc-500">
          <span>{cardCount} card{cardCount === 1 ? '' : 's'} · Suggested: {activeSource.suggestedText}</span>
          <button
            type="button"
            onClick={() => dispatch({
              type: 'UPDATE_LETTER_STENCIL_TOOL',
              updates: { text: activeSource.suggestedText },
            })}
            className="rounded-full border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
          >
            Use sample
          </button>
        </div>
        <textarea
          aria-label="Stencil text"
          value={letterStencilTool.text}
          onChange={(e) => dispatch({
            type: 'UPDATE_LETTER_STENCIL_TOOL',
            updates: { text: e.target.value },
          })}
          rows={3}
          placeholder={selectedAlphabet.suggestedText}
          className="resize-y rounded border border-zinc-700 bg-zinc-800 px-2 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-400">Stone size</span>
        <select
          aria-label="Stencil stone size"
          value={letterStencilTool.stoneSize}
          onChange={(e) => dispatch({
            type: 'UPDATE_LETTER_STENCIL_TOOL',
            updates: { stoneSize: e.target.value as typeof letterStencilTool.stoneSize },
          })}
          className="rounded border border-zinc-700 bg-zinc-800 px-2 py-2 text-sm text-white"
        >
          {supportedStoneSizes.map((size) => (
            <option key={size} value={size}>
              {size}{size in TRW_STONE_SIZE_CALIBRATION ? ` — ${TRW_STONE_SIZE_CALIBRATION[size as keyof typeof TRW_STONE_SIZE_CALIBRATION].diameterMm} mm` : ''}
            </option>
          ))}
        </select>
        {calibration && (
          <span className="text-[11px] text-zinc-500">
            Authoritative hole diameter: {calibration.diameterMm} mm
          </span>
        )}
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-400">Layout mode</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => dispatch({ type: 'UPDATE_LETTER_STENCIL_TOOL', updates: { layoutMode: 'preview' } })}
            className={`rounded-xl border px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-purple-500 ${letterStencilTool.layoutMode === 'preview' ? 'border-purple-500/50 bg-purple-500/15 text-white' : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'}`}
          >
            <div className="font-medium">Preview</div>
            <div className="mt-1 text-[10px] text-zinc-500">Cards edge-to-edge, for visual word preview only</div>
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'UPDATE_LETTER_STENCIL_TOOL', updates: { layoutMode: 'cut-sheet' } })}
            className={`rounded-xl border px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-purple-500 ${letterStencilTool.layoutMode === 'cut-sheet' ? 'border-purple-500/50 bg-purple-500/15 text-white' : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'}`}
          >
            <div className="font-medium">Cut sheet</div>
            <div className="mt-1 text-[10px] text-zinc-500">Framed cards with cut spacing, ready to cut</div>
          </button>
        </div>
        <span className="text-[11px] text-zinc-500">{modeCopy}</span>
      </div>

      <NumericInput
        label="Card padding"
        value={letterStencilTool.cardPaddingMm}
        onChange={(value) => dispatch({
          type: 'UPDATE_LETTER_STENCIL_TOOL',
          updates: { cardPaddingMm: value },
        })}
        unit="mm"
        min={0}
        max={20}
        step={0.5}
      />

      <NumericInput
        label="Card corner radius"
        value={letterStencilTool.cardCornerRadiusMm}
        onChange={(value) => dispatch({
          type: 'UPDATE_LETTER_STENCIL_TOOL',
          updates: { cardCornerRadiusMm: value },
        })}
        unit="mm"
        min={0}
        max={15}
        step={0.5}
      />

      <NumericInput
        label="Minimum card width"
        value={letterStencilTool.minCardWidthMm}
        onChange={(value) => dispatch({
          type: 'UPDATE_LETTER_STENCIL_TOOL',
          updates: { minCardWidthMm: value },
        })}
        unit="mm"
        min={0}
        max={50}
        step={1}
      />

      {letterStencilTool.layoutMode === 'cut-sheet' && (
        <NumericInput
          label="Gap between cards"
          value={letterStencilTool.cutSheetGapMm}
          onChange={(value) => dispatch({
            type: 'UPDATE_LETTER_STENCIL_TOOL',
            updates: { cutSheetGapMm: value },
          })}
          unit="mm"
          min={0}
          max={20}
          step={0.5}
        />
      )}

      {letterStencilTool.unsupportedCharacters.length > 0 && (
        <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs text-amber-100">
          Unsupported characters: {letterStencilTool.unsupportedCharacters.join(', ')}
        </div>
      )}
    </div>
  );
}

function TemplateImportToolProperties({ state, dispatch }: EditorPropertiesPanelProps) {
  const { templateImportTool } = state;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const svgText = typeof reader.result === 'string' ? reader.result : '';
      try {
        const result = createImportedTemplate({
          svgText,
          defaultStoneSizeId: templateImportTool.defaultStoneSize,
          deduplicateTolerance: 0.01,
        });
        if (result.template.stones.length === 0) {
          dispatch({
            type: 'UPDATE_TEMPLATE_IMPORT_TOOL',
            updates: {
              pendingSvgText: null,
              pendingFileName: file.name,
              importError: 'No identifiable stones found. Use SVG Convert Shape if this file contains artwork rather than a rhinestone template.',
              importSummary: null,
            },
          });
          return;
        }

        dispatch({
          type: 'UPDATE_TEMPLATE_IMPORT_TOOL',
          updates: {
            pendingSvgText: svgText,
            pendingFileName: file.name,
            detectedDiameters: result.detectedDiameters,
            detectedColors: result.detectedColors,
            ignoredElements: result.ignoredElements,
            warnings: result.warnings,
            importSummary: `${result.template.stones.length} stones ready to import`,
            importError: null,
          },
        });
      } catch (error) {
        dispatch({
          type: 'UPDATE_TEMPLATE_IMPORT_TOOL',
          updates: {
            pendingSvgText: null,
            pendingFileName: file.name,
            importSummary: null,
            importError: error instanceof Error ? error.message : String(error),
          },
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmImport = () => {
    if (!templateImportTool.pendingSvgText) return;
    dispatch({
      type: 'UPDATE_TEMPLATE_IMPORT_TOOL',
      updates: {
        uploadedSvgText: templateImportTool.pendingSvgText,
        svgFileName: templateImportTool.pendingFileName,
        pendingSvgText: null,
        pendingFileName: null,
        importError: null,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-3 text-xs text-blue-100">
        Imports circles already positioned as stones. For a logo or ordinary
        vector shape, choose SVG Convert Shape instead.
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-400">Existing rhinestone template</span>
        <input
          aria-label="Existing rhinestone template"
          type="file"
          accept=".svg,image/svg+xml"
          onChange={handleFileSelect}
          className="text-xs text-zinc-300 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-purple-600 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-purple-700"
        />
      </label>

      <StoneProfileControl
        value={templateImportTool.defaultStoneSize}
        onChange={(defaultStoneSize) => dispatch({
          type: 'UPDATE_TEMPLATE_IMPORT_TOOL',
          updates: { defaultStoneSize },
        })}
      />
      <p className="-mt-2 text-[11px] text-zinc-500">
        Fallback label only. Imported circle diameter remains unchanged.
      </p>

      {templateImportTool.importError && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-xs text-red-100">
          {templateImportTool.importError}
        </div>
      )}

      {templateImportTool.pendingSvgText && (
        <div className="space-y-3 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-xs text-zinc-300">
          <p className="font-medium text-white">{templateImportTool.importSummary}</p>
          <p>Diameters: {templateImportTool.detectedDiameters.join(', ')} mm</p>
          <p>Colors: {templateImportTool.detectedColors.join(', ') || 'none'}</p>
          <p>Ignored decorative elements: {templateImportTool.ignoredElements}</p>
          {templateImportTool.warnings.map((warning) => <p key={warning} className="text-amber-200">{warning}</p>)}
          <button
            type="button"
            onClick={confirmImport}
            className="w-full rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-500"
          >
            Import stones to canvas
          </button>
        </div>
      )}

      {templateImportTool.uploadedSvgText && (
        <p className="text-xs text-emerald-300">
          Imported: {templateImportTool.svgFileName ?? 'template.svg'}
        </p>
      )}
    </div>
  );
}

function SvgToolProperties({ state, dispatch }: EditorPropertiesPanelProps) {
  const { svgTool } = state;
  const svgCapabilities = getGeneratorCapabilityProfile('svg');
  const currentArtworkName = svgTool.assetKind === 'image' ? svgTool.imageFileName : svgTool.svgFileName;
  const uploadInputId = 'artwork-upload-input';
  const displayUnit = svgTool.dimensionUnit;
  const toDisplayUnit = (value: number | '') => {
    if (value === '') return '';
    return displayUnit === 'in' ? Number((value / 25.4).toFixed(3)) : value;
  };
  const fromDisplayUnit = (value: number | '') => {
    if (value === '') return '';
    return displayUnit === 'in' ? Number((value * 25.4).toFixed(3)) : value;
  };

  const loadArtworkFile = (file: File | null | undefined) => {
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isSvg = file.type === 'image/svg+xml' || lowerName.endsWith('.svg');

    const reader = new FileReader();
    reader.onload = () => {
      if (isSvg) {
        const svgText = reader.result as string;
        dispatch({
          type: 'UPDATE_SVG_TOOL',
          updates: {
            assetKind: 'svg',
            uploadedSvgText: svgText,
            svgFileName: file.name,
            uploadedImageDataUrl: null,
            imageFileName: null,
          },
        });
      } else {
        dispatch({
          type: 'UPDATE_SVG_TOOL',
          updates: {
            assetKind: 'image',
            uploadedImageDataUrl: reader.result as string,
            imageFileName: file.name,
            uploadedSvgText: null,
            svgFileName: null,
          },
        });
      }
    };
    if (isSvg) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    loadArtworkFile(file);
    e.target.value = ''; // Reset for re-upload
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    loadArtworkFile(e.dataTransfer.files?.[0]);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const fileItem = Array.from(e.clipboardData.items).find((item) => item.kind === 'file');
    if (!fileItem) return;
    e.preventDefault();
    loadArtworkFile(fileItem.getAsFile());
  };

  return (
    <div className="space-y-4">
      {/* File Upload */}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-400">Upload artwork</span>
        <div
          tabIndex={0}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onPaste={handlePaste}
          className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950 px-4 py-4 text-center text-sm text-zinc-300 outline-none transition hover:border-zinc-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
        >
          <p>Drag and drop or paste artwork here.</p>
          <p className="mt-1 text-[11px] text-zinc-500">Use the file picker below if you prefer browsing.</p>
        </div>
        <input
          id={uploadInputId}
          type="file"
          accept=".svg,image/svg+xml,.png,.jpg,.jpeg,.webp,.bmp,.gif,image/png,image/jpeg,image/webp,image/bmp,image/gif"
          onChange={handleFileSelect}
          className="text-xs text-zinc-300 file:mr-3 file:px-3 file:py-2 file:rounded file:border-0 file:bg-purple-600 file:text-white file:text-xs file:font-medium hover:file:bg-purple-700 file:cursor-pointer cursor-pointer"
        />
        <span className="text-[11px] text-zinc-500">Supports SVG, PNG, JPG, WEBP, BMP, and GIF.</span>
        {currentArtworkName && (
          <span className="text-xs text-zinc-400 mt-1">📄 {currentArtworkName}</span>
        )}
      </label>

      {svgTool.assetKind === 'image' && svgTool.uploadedImageDataUrl && (
        <>
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-3 text-xs text-purple-100">
            Converts a raster image into a rhinestone layout using thresholded image sampling, color layers, and physical stone spacing.
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
            <div className="border-b border-zinc-800 px-3 py-2 text-xs font-medium text-zinc-400">Original image</div>
            <img
              src={svgTool.uploadedImageDataUrl}
              alt={currentArtworkName ?? 'Uploaded artwork preview'}
              className="max-h-56 w-full object-contain bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.14),_transparent_35%),linear-gradient(180deg,_#111827,_#09090b)]"
            />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium text-zinc-400">Number of stone colors</span>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { imageColorCount: count as 1 | 2 | 3 | 4 } })}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${svgTool.imageColorCount === count ? 'border-purple-500/50 bg-purple-500/15 text-white' : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'}`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <StoneProfileControl
            value={svgTool.stoneSize}
            onChange={(size) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { stoneSize: size } })}
          />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-400">Target Dimensions</span>
              <div className="ml-auto inline-flex rounded-lg border border-zinc-700 bg-zinc-900 p-1 text-xs">
                {(['in', 'mm'] as const).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { dimensionUnit: unit } })}
                    className={`rounded px-2 py-1 transition ${displayUnit === unit ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <NumericInput
                label="Width"
                value={toDisplayUnit(svgTool.targetWidthMm)}
                onChange={(value) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { targetWidthMm: fromDisplayUnit(value) } })}
                unit={displayUnit}
                min={displayUnit === 'in' ? 0.25 : 5}
                max={displayUnit === 'in' ? 30 : 762}
                step={displayUnit === 'in' ? 0.1 : 0.1}
              />
              <NumericInput
                label="Height"
                value={toDisplayUnit(svgTool.targetHeightMm)}
                onChange={(value) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { targetHeightMm: fromDisplayUnit(value) } })}
                unit={displayUnit}
                min={displayUnit === 'in' ? 0.25 : 5}
                max={displayUnit === 'in' ? 30 : 762}
                step={displayUnit === 'in' ? 0.1 : 0.1}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={svgTool.preserveAspectRatio}
                onChange={(e) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { preserveAspectRatio: e.target.checked } })}
                className="h-3.5 w-3.5 rounded"
              />
              Lock ratio
            </label>
          </div>

          <NumericInput
            label="Stone spacing"
            value={toDisplayUnit(svgTool.customSpacingMm)}
            onChange={(value) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { customSpacingMm: fromDisplayUnit(value), densityPreset: 'custom' } })}
            unit={displayUnit}
            min={displayUnit === 'in' ? 0.03 : 0.75}
            max={displayUnit === 'in' ? 1 : 25}
            step={displayUnit === 'in' ? 0.01 : 0.1}
          />

          <NumericInput
            label="Threshold"
            value={svgTool.imageThreshold}
            onChange={(value) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { imageThreshold: typeof value === 'number' ? value : 128 } })}
            min={0}
            max={255}
            step={1}
            helpText="Lower values keep only darker regions. Higher values keep more of the image."
          />

          <NumericInput
            label="Refine details"
            value={svgTool.imageDetail}
            onChange={(value) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { imageDetail: typeof value === 'number' ? value : 128 } })}
            min={0}
            max={255}
            step={1}
            helpText="Higher values keep small details. Lower values smooth isolated noise."
          />

          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={svgTool.imageInvert}
              onChange={(e) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { imageInvert: e.target.checked } })}
              className="h-3.5 w-3.5 rounded"
            />
            Invert fill (place stones on lighter regions)
          </label>
        </>
      )}

      {svgTool.assetKind === 'svg' && svgTool.uploadedSvgText && (
        <>
          <div className="space-y-2">
            <span className="text-xs font-medium text-zinc-400">SVG mode</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { renderMode: 'vector-layout' } })}
                className={`rounded-xl border px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-purple-500 ${svgTool.renderMode === 'vector-layout' ? 'border-purple-500/50 bg-purple-500/15 text-white' : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'}`}
              >
                <div className="font-medium">Vector layout</div>
                <div className="mt-1 text-[10px] text-zinc-500">Contour-aware placement from SVG paths</div>
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { renderMode: 'artwork-dots' } })}
                className={`rounded-xl border px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-purple-500 ${svgTool.renderMode === 'artwork-dots' ? 'border-purple-500/50 bg-purple-500/15 text-white' : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'}`}
              >
                <div className="font-medium">Artwork dots</div>
                <div className="mt-1 text-[10px] text-zinc-500">Dense fill-first sampling for logos and badges</div>
              </button>
            </div>
            <p className="text-[11px] text-zinc-500">
              {svgTool.renderMode === 'artwork-dots'
                ? 'Artwork dots uses fill-only hexagonal sampling and is intended to mimic image-to-dot style rhinestone layouts.'
                : 'Vector layout keeps the SVG as vector artwork and is better for cleaner outline-driven results.'}
            </p>
          </div>

          {/* Stone Size */}
          <StoneProfileControl
            value={svgTool.stoneSize}
            onChange={(size) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { stoneSize: size } })}
          />

          {/* Target Dimensions */}
          <PhysicalDimensionsControl
            widthMm={svgTool.targetWidthMm}
            heightMm={svgTool.targetHeightMm}
            preserveAspectRatio={svgTool.preserveAspectRatio}
            onWidthChange={(val) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { targetWidthMm: val } })}
            onHeightChange={(val) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { targetHeightMm: val } })}
            onPreserveAspectRatioChange={(val) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { preserveAspectRatio: val } })}
          />

          {svgTool.renderMode === 'vector-layout' && (
            <FillModeControl
              fillMode={svgTool.fillMode}
              fillPattern={svgTool.fillPattern}
              availableModes={svgCapabilities.supportedCoverageModes.filter((mode): mode is 'outline' | 'fill' | 'outline-fill' => mode !== 'contour')}
              availablePatterns={svgCapabilities.supportedFillPatterns}
              onFillModeChange={(mode) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { fillMode: mode } })}
              onFillPatternChange={(pattern) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { fillPattern: pattern } })}
            />
          )}

          {/* Density */}
          <DensityControl
            densityPreset={svgTool.densityPreset}
            customSpacingMm={svgTool.customSpacingMm}
            onDensityChange={(preset) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { densityPreset: preset } })}
            onCustomSpacingChange={(val) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { customSpacingMm: val } })}
          />

          {svgTool.renderMode === 'vector-layout' ? (
            <PlacementModeControl
              coverageMode={svgTool.coverageMode}
              availableCoverageModes={svgCapabilities.supportedCoverageModes}
              placementPattern={svgTool.placementPattern}
              availablePlacementPatterns={svgCapabilities.supportedPlacementPatterns.filter((pattern): pattern is 'default' | 'hexagonal' | 'radial' => pattern === 'default' || pattern === 'hexagonal' || pattern === 'radial')}
              contourSettings={svgTool.contourSettings}
              radialSettings={svgTool.radialSettings}
              onCoverageModeChange={(coverageMode) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { coverageMode } })}
              onPlacementPatternChange={(placementPattern) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { placementPattern } })}
              onContourSettingsChange={(contourSettings) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { contourSettings } })}
              onRadialSettingsChange={(radialSettings) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { radialSettings } })}
            />
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-xs text-zinc-400">
              Artwork dots currently uses fill-only coverage with a hexagonal placement pattern.
            </div>
          )}

          {/* Advanced - Cleanup Options */}
          <AdvancedSection title="Cleanup Options">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={svgTool.cleanupEnabled}
                onChange={(e) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { cleanupEnabled: e.target.checked } })}
                className="h-3.5 w-3.5 rounded"
              />
              <span className="text-sm text-zinc-300">Enable Cleanup</span>
            </label>

            {svgTool.cleanupEnabled && (
              <div className="space-y-3 mt-3 pl-2 border-l-2 border-zinc-800">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={svgTool.cleanupSimplify}
                    onChange={(e) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { cleanupSimplify: e.target.checked } })}
                    className="h-3.5 w-3.5 rounded"
                  />
                  <span className="text-sm text-zinc-300">Simplify (RDP)</span>
                </label>

                {svgTool.cleanupSimplify && (
                  <NumericInput
                    label="Simplify Tolerance"
                    value={svgTool.cleanupSimplifyTol}
                    onChange={(val) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { cleanupSimplifyTol: typeof val === 'number' ? val : 0.1 } })}
                    unit="mm"
                    min={0.01}
                    max={5}
                    step={0.1}
                  />
                )}

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={svgTool.cleanupRemoveTiny}
                    onChange={(e) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { cleanupRemoveTiny: e.target.checked } })}
                    className="h-3.5 w-3.5 rounded"
                  />
                  <span className="text-sm text-zinc-300">Remove Tiny Lines</span>
                </label>

                {svgTool.cleanupRemoveTiny && (
                  <NumericInput
                    label="Min Line Length"
                    value={svgTool.cleanupMinLength}
                    onChange={(val) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { cleanupMinLength: typeof val === 'number' ? val : 1 } })}
                    unit="mm"
                    min={0.1}
                    max={10}
                    step={0.1}
                  />
                )}

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={svgTool.cleanupRemoveDups}
                    onChange={(e) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { cleanupRemoveDups: e.target.checked } })}
                    className="h-3.5 w-3.5 rounded"
                  />
                  <span className="text-sm text-zinc-300">Deduplicate Points</span>
                </label>

                {svgTool.cleanupRemoveDups && (
                  <NumericInput
                    label="Duplicate Tolerance"
                    value={svgTool.cleanupDupTol}
                    onChange={(val) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { cleanupDupTol: typeof val === 'number' ? val : 0.01 } })}
                    unit="mm"
                    min={0.001}
                    max={1}
                    step={0.01}
                  />
                )}
              </div>
            )}
          </AdvancedSection>
        </>
      )}
    </div>
  );
}

function GridToolProperties({ state, dispatch }: EditorPropertiesPanelProps) {
  const { gridTool } = state;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <NumericInput
          label="Columns"
          value={gridTool.columns}
          onChange={(val) => dispatch({ type: 'UPDATE_GRID_TOOL', updates: { columns: typeof val === 'number' ? val : 1 } })}
          min={1}
          max={100}
        />

        <NumericInput
          label="Rows"
          value={gridTool.rows}
          onChange={(val) => dispatch({ type: 'UPDATE_GRID_TOOL', updates: { rows: typeof val === 'number' ? val : 1 } })}
          min={1}
          max={100}
        />
      </div>

      <StoneProfileControl
        value={gridTool.stoneSize}
        onChange={(size) => dispatch({ type: 'UPDATE_GRID_TOOL', updates: { stoneSize: size } })}
      />

      <DensityControl
        densityPreset={gridTool.densityPreset}
        customSpacingMm={gridTool.customSpacingMm}
        onDensityChange={(preset) => dispatch({ type: 'UPDATE_GRID_TOOL', updates: { densityPreset: preset } })}
        onCustomSpacingChange={(val) => dispatch({ type: 'UPDATE_GRID_TOOL', updates: { customSpacingMm: val } })}
      />
    </div>
  );
}

function ManualToolProperties({ state, dispatch }: EditorPropertiesPanelProps) {
  const { manualTool } = state;
  
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-300">
        <p className="font-medium text-white">Manual placement</p>
        <p className="mt-1 text-xs text-zinc-500">Place stones directly on the canvas. Snap controls affect placement only and never export.</p>
      </div>
      
      {/* Stone Size */}
      <StoneProfileControl
        value={manualTool.addStoneSize}
        onChange={(size) => dispatch({ type: 'UPDATE_MANUAL_TOOL', updates: { addStoneSize: size } })}
      />
      
      {/* Snap to Grid */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs font-medium text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={manualTool.snapToGrid}
            onChange={(e) => dispatch({ type: 'UPDATE_MANUAL_TOOL', updates: { snapToGrid: e.target.checked } })}
            className="rounded border-zinc-700 bg-zinc-800 text-purple-600 focus:ring-purple-600 focus:ring-offset-0"
          />
          Snap to Grid
        </label>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3">
          <NumericInput
            label="Grid Size (mm)"
            value={manualTool.gridSnapSize}
            onChange={(val) => dispatch({ type: 'UPDATE_MANUAL_TOOL', updates: { gridSnapSize: val as number } })}
            min={1}
            max={50}
            step={1}
            unit="mm"
            disabled={!manualTool.snapToGrid}
          />
          {!manualTool.snapToGrid && <p className="mt-2 text-[11px] text-zinc-500">Enable Snap to Grid to adjust the placement step size.</p>}
        </div>
      </div>
      
      <div className="pt-4 border-t border-zinc-700 space-y-2">
        <p className="text-xs text-zinc-400">Keyboard shortcuts:</p>
        <ul className="text-xs text-zinc-500 space-y-1">
          <li>• Click to place stone</li>
          <li>• Switch to Select to edit</li>
        </ul>
      </div>
    </div>
  );
}

function SelectToolProperties({ state, dispatch }: EditorPropertiesPanelProps) {
  const selectedCount = state.selectedStoneIds.size;
  const { editableTemplate } = state;
  const actionState = getSelectionActionState(selectedCount);
  const emptyState = getSelectionEmptyState(editableTemplate.isEditable);
  
  // Get selected stone(s) for position editing
  const selectedStone = selectedCount === 1 
    ? editableTemplate.stones.find(s => state.selectedStoneIds.has(s.id))
    : null;

  return (
    <div className="space-y-4">
      {selectedCount === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950 px-4 py-4">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <ScanSearch className="h-4 w-4 text-purple-400" />
            {emptyState.title}
          </div>
          <p className="mt-2 text-sm text-zinc-400">{emptyState.description}</p>
          <ul className="mt-3 space-y-2 text-xs text-zinc-500">
            {emptyState.tips.map((tip) => (
              <li key={tip}>• {tip}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
          <p className="text-sm font-medium text-white">{selectedCount} stone{selectedCount > 1 ? 's' : ''} selected</p>
          <p className="mt-1 text-xs text-zinc-500">Selection actions only affect the highlighted stones.</p>
        </div>
      )}
      
      {/* Single stone position editing */}
      {selectedStone && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-zinc-400">Position</label>
          <div className="grid grid-cols-2 gap-2">
            <NumericInput
              label="X (mm)"
              value={selectedStone.center.x}
              onChange={(val) => {
                if (typeof val === 'number') {
                  dispatch({
                    type: 'UPDATE_STONE',
                    id: selectedStone.id,
                    updates: { center: { ...selectedStone.center, x: val } },
                  });
                }
              }}
              min={0}
              max={1000}
              step={0.1}
            />
            <NumericInput
              label="Y (mm)"
              value={selectedStone.center.y}
              onChange={(val) => {
                if (typeof val === 'number') {
                  dispatch({
                    type: 'UPDATE_STONE',
                    id: selectedStone.id,
                    updates: { center: { ...selectedStone.center, y: val } },
                  });
                }
              }}
              min={0}
              max={1000}
              step={0.1}
            />
          </div>

          <StoneProfileControl
            value={selectedStone.stoneSize}
            onChange={(size) => {
              const profile = getStoneSizeProfile(size);
              dispatch({
                type: 'UPDATE_STONE',
                id: selectedStone.id,
                updates: {
                  stoneSize: size,
                  holeDiameterMm: profile.recommendedHoleDiameterMm,
                },
              });
            }}
          />

          <NumericInput
            label="Hole Diameter"
            value={selectedStone.holeDiameterMm}
            onChange={(val) => {
              if (typeof val === 'number') {
                dispatch({
                  type: 'UPDATE_STONE',
                  id: selectedStone.id,
                  updates: { holeDiameterMm: val },
                });
              }
            }}
            unit="mm"
            min={0.1}
            max={20}
            step={0.1}
          />
        </div>
      )}
      
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => dispatch({ type: 'DUPLICATE_STONES', stoneIds: Array.from(state.selectedStoneIds) })}
            disabled={!actionState.canDuplicate}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
            title={actionState.duplicateReason ?? 'Duplicate selected stones (Cmd/Ctrl+D)'}
          >
            <CopyPlus className="h-3.5 w-3.5" />
            Duplicate
          </button>
          <button
            onClick={() => dispatch({ type: 'DELETE_STONES', stoneIds: Array.from(state.selectedStoneIds) })}
            disabled={!actionState.canDelete}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            title={actionState.deleteReason ?? 'Delete selected stones (Delete/Backspace)'}
          >
            <DiamondMinus className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-zinc-400">Align</label>
            {!actionState.canAlign && <span className="text-[11px] text-zinc-500">Select at least two stones</span>}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button onClick={() => dispatch({ type: 'ALIGN_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'left' })} disabled={!actionState.canAlign} className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-100 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40" title={actionState.alignReason ?? 'Align selected stones to the left'}><MoveHorizontal className="mx-auto h-3.5 w-3.5 rotate-180" /></button>
            <button onClick={() => dispatch({ type: 'ALIGN_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'center' })} disabled={!actionState.canAlign} className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-100 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40" title={actionState.alignReason ?? 'Align selected stones to the center'}><MoveHorizontal className="mx-auto h-3.5 w-3.5" /></button>
            <button onClick={() => dispatch({ type: 'ALIGN_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'right' })} disabled={!actionState.canAlign} className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-100 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40" title={actionState.alignReason ?? 'Align selected stones to the right'}><MoveHorizontal className="mx-auto h-3.5 w-3.5" /></button>
            <button onClick={() => dispatch({ type: 'ALIGN_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'top' })} disabled={!actionState.canAlign} className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-100 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40" title={actionState.alignReason ?? 'Align selected stones to the top'}><MoveVertical className="mx-auto h-3.5 w-3.5 rotate-180" /></button>
            <button onClick={() => dispatch({ type: 'ALIGN_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'middle' })} disabled={!actionState.canAlign} className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-100 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40" title={actionState.alignReason ?? 'Align selected stones to the vertical middle'}><MoveVertical className="mx-auto h-3.5 w-3.5" /></button>
            <button onClick={() => dispatch({ type: 'ALIGN_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'bottom' })} disabled={!actionState.canAlign} className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-100 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40" title={actionState.alignReason ?? 'Align selected stones to the bottom'}><MoveVertical className="mx-auto h-3.5 w-3.5" /></button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-zinc-400">Distribute</label>
            {!actionState.canDistribute && <span className="text-[11px] text-zinc-500">Select at least three stones</span>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => dispatch({ type: 'DISTRIBUTE_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'horizontal' })} disabled={!actionState.canDistribute} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40" title={actionState.distributeReason ?? 'Distribute selected stones horizontally'}>Horizontal</button>
            <button onClick={() => dispatch({ type: 'DISTRIBUTE_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'vertical' })} disabled={!actionState.canDistribute} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40" title={actionState.distributeReason ?? 'Distribute selected stones vertically'}>Vertical</button>
          </div>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="space-y-3">
          <div className="pt-3 border-t border-zinc-700 text-xs text-zinc-400 space-y-1">
            <p className="font-medium">Selection Controls:</p>
            <ul className="text-zinc-500 space-y-1">
              <li>• Drag to move</li>
              <li>• Shift+Click for multi-select</li>
              <li>• Ctrl/Cmd+D to duplicate</li>
              <li>• Ctrl/Cmd+C to copy</li>
              <li>• Ctrl/Cmd+V to paste</li>
              <li>• Delete/Backspace to remove</li>
              <li>• Escape to deselect</li>
            </ul>
          </div>
        </div>
      )}
      
      {!editableTemplate.isEditable && state.template && (
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-4">
          <button
            onClick={() => dispatch({ type: 'CONVERT_TO_EDITABLE' })}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-purple-500"
            title="Convert the generated output into individually editable stones"
          >
            <Hand className="h-4 w-4" />
            Make Editable
          </button>
          <p className="mt-2 text-xs text-zinc-300">
            Generated output is still driven by the source settings. Make Editable unlocks per-stone editing while keeping the original generator available.
          </p>
        </div>
      )}
      
      <div className="pt-4 border-t border-zinc-700 space-y-2">
        <p className="text-xs text-zinc-400">Keyboard shortcuts:</p>
        <ul className="text-xs text-zinc-500 space-y-1">
          <li>• Cmd/Ctrl+Z to undo</li>
          <li>• Cmd/Ctrl+Shift+Z to redo</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToolTitle(tool: EditorTool): string {
  switch (tool) {
    case 'select': return 'Selection';
    case 'text': return 'Text Source';
    case 'svg': return 'Artwork Source';
    case 'grid': return 'Grid Source';
    case 'rhinestone-font': return 'Rhinestone Font';
    case 'svg-alphabet': return 'SVG Alphabet';
    case 'letter-stencil': return 'Letter Stencils';
    case 'template-import': return 'Template Import';
    case 'manual': return 'Manual Source';
  }
}
