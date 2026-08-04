'use client';

import { CopyPlus, DiamondMinus, Hand, MoveHorizontal, MoveVertical, PenLine, ScanSearch, Sparkles } from 'lucide-react';
import {
  createImportedTemplate,
  getRecommendedCenterDistance,
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
import { EditorState, EditorAction, EditorTool } from './EditorState';
import StoneProfileControl from './controls/StoneProfileControl';
import DensityControl from './controls/DensityControl';
import PhysicalDimensionsControl from './controls/PhysicalDimensionsControl';
import NumericInput from './controls/NumericInput';
import AdvancedSection from './controls/AdvancedSection';
import FillModeControl from './controls/FillModeControl';
import FontPicker, { type OutlineFontStatus } from './controls/FontPicker';
import PlacementModeControl from './controls/PlacementModeControl';
import { EDITOR_TOOLS, getEditableStatusCopy, getSelectionActionState, getSelectionEmptyState, getSourcePanelTool } from './editorUi';
import { getGeneratorCapabilityProfile } from '@/src/lib/rhinestone-engine/index';
import { findNearestValidStonePosition } from './collisionDetection';

interface EditorPropertiesPanelProps {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  mode: 'source' | 'inspector';
  outlineFontStatus?: OutlineFontStatus;
}

interface ToolPropertiesProps {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  outlineFontStatus?: OutlineFontStatus;
}

function PanelSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface-raised p-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {description && <p className="mt-1 text-xs text-ink-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function ToolSwitcher({ activeTool, dispatch }: { activeTool: EditorState['activeTool']; dispatch: React.Dispatch<EditorAction> }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {EDITOR_TOOLS.map((tool) => {
        const Icon = tool.icon;
        return (
          <button
            key={tool.id}
            onClick={() => dispatch({ type: 'SET_ACTIVE_TOOL', tool: tool.id })}
            className={`rounded-xl border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${activeTool === tool.id ? 'border-accent-400 bg-accent-50 text-ink' : 'border-border bg-surface-sunken text-ink-secondary hover:border-border-strong hover:bg-sand-50'}`}
            title={tool.description}
          >
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <span className="text-sm font-medium">{tool.label}</span>
            </div>
            <p className="mt-2 text-[11px] text-ink-muted">{tool.description}</p>
          </button>
        );
      })}
    </div>
  );
}

export default function EditorPropertiesPanel({ state, dispatch, mode, outlineFontStatus }: EditorPropertiesPanelProps) {
  if (mode === 'source') {
    const sourceTool = getSourcePanelTool(state);
    const statusCopy = getEditableStatusCopy(state.editableTemplate.isEditable);
    return (
      <aside className="h-full w-full border-r border-border bg-surface-raised/90 p-4">
        <div className="flex h-full flex-col gap-4 overflow-y-auto">
          <PanelSection title="Tools" description="Choose how you want to work with this design.">
            <ToolSwitcher activeTool={state.activeTool} dispatch={dispatch} />
          </PanelSection>

          {state.activeTool === 'select' ? (
            <PanelSection title="Select tool" description="Click, shift-click, or drag a box on the canvas to select stones.">
              <p className="text-xs text-ink-muted">Fine-tune the selection — position, alignment, and export options — in the Inspector panel on the right.</p>
            </PanelSection>
          ) : (
            <>
              <PanelSection title={statusCopy.label} description={statusCopy.description}>
                <div className={`rounded-xl border px-3 py-3 ${state.editableTemplate.isEditable ? 'border-info-500/30 bg-info-50 text-info-600' : 'border-accent-300 bg-accent-50 text-accent-700'}`}>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {state.editableTemplate.isEditable ? <PenLine className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                    <span>{statusCopy.label}</span>
                  </div>
                  <p className="mt-2 text-xs text-ink-secondary">{statusCopy.actionHint}</p>
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
            </>
          )}
        </div>
      </aside>
    );
  }

  if (mode === 'inspector') {
    return (
      <aside className="h-full w-full border-l border-border bg-surface-raised/90 p-4">
        <div className="flex h-full flex-col gap-4 overflow-y-auto">
          <PanelSection title="Inspector" description="Selection, position, alignment, and export controls live here.">
            <SelectToolProperties state={state} dispatch={dispatch} />
          </PanelSection>

          <PanelSection title="Export Settings" description="These options affect only the exported SVG output.">
            <label className="flex items-center gap-2 text-sm text-ink-secondary">
              <input
                type="checkbox"
                checked={state.includeGuideBox}
                onChange={(e) => dispatch({ type: 'UPDATE_EXPORT_SETTINGS', updates: { includeGuideBox: e.target.checked } })}
                className="h-4 w-4 rounded border-border bg-surface-sunken"
              />
              Include guide box
            </label>

            <label className="flex items-center gap-2 text-sm text-ink-secondary">
              <input
                type="checkbox"
                checked={state.includeLabels}
                onChange={(e) => dispatch({ type: 'UPDATE_EXPORT_SETTINGS', updates: { includeLabels: e.target.checked } })}
                className="h-4 w-4 rounded border-border bg-surface-sunken"
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
}

// ─── Tool-Specific Property Panels ───────────────────────────────────────────

function TextToolProperties({ state, dispatch, outlineFontStatus }: ToolPropertiesProps) {
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
              ? 'bg-accent-500 text-ink-inverse'
              : 'bg-surface-sunken text-ink-secondary hover:bg-sand-200'
          }`}
        >
          Outline
        </button>
        <button
          onClick={() => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { mode: 'dot-matrix' } })}
          className={`flex-1 px-3 py-2 text-xs font-medium rounded transition ${
            textTool.mode === 'dot-matrix'
              ? 'bg-accent-500 text-ink-inverse'
              : 'bg-surface-sunken text-ink-secondary hover:bg-sand-200'
          }`}
        >
          Dot Matrix
        </button>
      </div>

      {/* Text Input */}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">Text</span>
        <textarea
          value={textTool.text}
          onChange={(e) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { text: e.target.value } })}
          rows={3}
          placeholder="Enter text..."
          className="bg-surface-sunken border border-border rounded px-3 py-2 text-sm text-ink font-mono focus:outline-none focus:ring-1 focus:ring-accent-400 resize-none"
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
          <span className="text-xs font-medium text-ink-secondary">Text style</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { outlineTextStyle: 'outline' } })}
              className={`rounded-xl border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${
                textTool.outlineTextStyle === 'outline'
                  ? 'border-accent-400 bg-accent-50 text-ink'
                  : 'border-border bg-surface-sunken text-ink-secondary hover:border-border hover:bg-surface-raised'
              }`}
            >
              <div className="text-sm font-medium">Outline text</div>
              <p className="mt-1 text-[11px] text-ink-muted">Follow the letter contours only.</p>
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { outlineTextStyle: 'filled-typography' } })}
              disabled={!fillModes.includes('fill')}
              className={`rounded-xl border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${
                textTool.outlineTextStyle === 'filled-typography'
                  ? 'border-accent-400 bg-accent-50 text-ink'
                  : 'border-border bg-surface-sunken text-ink-secondary hover:border-border hover:bg-surface-raised'
              } ${!fillModes.includes('fill') ? 'cursor-not-allowed opacity-50 hover:border-border hover:bg-surface-sunken' : ''}`}
            >
              <div className="text-sm font-medium">Filled typography</div>
              <p className="mt-1 text-[11px] text-ink-muted">Fill thicker letters with a stone pattern.</p>
            </button>
          </div>
        </div>
      )}

      {textTool.mode === 'outline' && selectedFontDefinition.supportedTextCoverageModes.length === 1 && !selectedFontDefinition.isLegacy && (
        <div className="rounded-xl border border-warning-500/30 bg-warning-50 px-3 py-3 text-xs text-warning-600">
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
            <span className="text-xs font-medium text-ink-secondary">Alignment</span>
            <select
              value={textTool.align}
              onChange={(e) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { align: e.target.value as 'left' | 'center' | 'right' } })}
              className="bg-surface-sunken border border-border rounded px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent-400"
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

function RhinestoneFontToolProperties({ state, dispatch }: ToolPropertiesProps) {
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
      <div className="rounded-xl border border-accent-300 bg-accent-50 px-3 py-3 text-xs text-accent-700">
        {modeCopy}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">Rhinestone font</span>
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
          className="rounded border border-border bg-surface-sunken px-2 py-2 text-sm text-ink"
        >
          {availableFonts.map((font) => (
            <option key={font.fontId} value={font.fontId}>
              {font.displayName} — {font.style}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-ink-muted">
          {selectedFontDefinition.category} · {selectedFontDefinition.style} · mode {rhinestoneFontTool.presentationMode} · supports {supportedStoneSizes.join(', ')}
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">Text</span>
        <div className="flex items-center justify-between gap-3 text-[11px] text-ink-muted">
          <span>Suggested sample: {selectedFontDefinition.suggestedText}</span>
          <button
            type="button"
            onClick={() => dispatch({
              type: 'UPDATE_RHINESTONE_FONT_TOOL',
              updates: { text: selectedFontDefinition.suggestedText },
            })}
            className="rounded-full border border-border px-2 py-1 text-[11px] text-ink-secondary transition hover:border-border-strong hover:bg-surface-sunken"
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
          className="resize-y rounded border border-border bg-surface-sunken px-2 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent-400"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">Stone size</span>
        <select
          aria-label="Rhinestone font stone size"
          value={rhinestoneFontTool.stoneSize}
          onChange={(e) => dispatch({
            type: 'UPDATE_RHINESTONE_FONT_TOOL',
            updates: { stoneSize: e.target.value as typeof rhinestoneFontTool.stoneSize },
          })}
          className="rounded border border-border bg-surface-sunken px-2 py-2 text-sm text-ink"
        >
          {supportedStoneSizes.map((size) => (
            <option key={size} value={size}>
              {size}{getStoneDiameterLabel(size) !== null ? ` — ${getStoneDiameterLabel(size)} mm` : ''}
            </option>
          ))}
        </select>
        {calibration && (
          <span className="text-[11px] text-ink-muted">
            Authoritative hole diameter: {calibration.diameterMm} mm
          </span>
        )}
        {selectedFontDefinition.limitations && selectedFontDefinition.limitations.length > 0 && (
          <span className="text-[11px] text-ink-muted">
            {selectedFontDefinition.limitations.join(' · ')}
          </span>
        )}
        {selectedFontDefinition.style === 'Digits' && (
          <span className="text-[11px] text-ink-muted">
            Best for numeric-only designs.
          </span>
        )}
        {selectedFontDefinition.style === 'Line' && (
          <span className="text-[11px] text-ink-muted">
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
        <div role="alert" className="rounded-xl border border-warning-500/30 bg-warning-50 px-3 py-3 text-xs text-warning-600">
          Unsupported characters: {rhinestoneFontTool.unsupportedCharacters.join(', ')}.
          They remain in the saved original text but do not generate stones.
        </div>
      )}
      {rhinestoneFontTool.presentationMode === 'digits' && /[A-Za-z]/.test(rhinestoneFontTool.text) && (
        <div role="alert" className="rounded-xl border border-warning-500/30 bg-warning-50 px-3 py-3 text-xs text-warning-600">
          This font is optimized for digits. Letter input may be unsupported or incomplete.
        </div>
      )}
    </div>
  );
}

function SvgAlphabetToolProperties({ state, dispatch }: ToolPropertiesProps) {
  const { svgAlphabetTool } = state;
  const availableAlphabets = listSvgAlphabets();
  const selectedAlphabet = getSvgAlphabetDefinition(svgAlphabetTool.svgAlphabetId as never);
  const supportedStoneSizes = selectedAlphabet.supportedTargetStoneSizeIds;
  const calibration = TRW_STONE_SIZE_CALIBRATION[
    svgAlphabetTool.stoneSize as keyof typeof TRW_STONE_SIZE_CALIBRATION
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-accent-300 bg-accent-50 px-3 py-3 text-xs text-accent-700">
        Composes text from a curated SVG alphabet where each letter is a separate glyph SVG. The engine reuses the letters as-is — no fill or outline pass runs.
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">Alphabet</span>
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
          className="rounded border border-border bg-surface-sunken px-2 py-2 text-sm text-ink"
        >
          {availableAlphabets.map((alphabet) => (
            <option key={alphabet.alphabetId} value={alphabet.alphabetId}>
              {alphabet.displayName} — {alphabet.style}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-ink-muted">
          {selectedAlphabet.category} · {selectedAlphabet.style} · supports {supportedStoneSizes.join(', ')}
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">Text</span>
        <div className="flex items-center justify-between gap-3 text-[11px] text-ink-muted">
          <span>Suggested sample: {selectedAlphabet.suggestedText}</span>
          <button
            type="button"
            onClick={() => dispatch({
              type: 'UPDATE_SVG_ALPHABET_TOOL',
              updates: { text: selectedAlphabet.suggestedText },
            })}
            className="rounded-full border border-border px-2 py-1 text-[11px] text-ink-secondary transition hover:border-border-strong hover:bg-surface-sunken"
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
          className="resize-y rounded border border-border bg-surface-sunken px-2 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent-400"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">Stone size</span>
        <select
          aria-label="SVG alphabet stone size"
          value={svgAlphabetTool.stoneSize}
          onChange={(e) => dispatch({
            type: 'UPDATE_SVG_ALPHABET_TOOL',
            updates: { stoneSize: e.target.value as typeof svgAlphabetTool.stoneSize },
          })}
          className="rounded border border-border bg-surface-sunken px-2 py-2 text-sm text-ink"
        >
          {supportedStoneSizes.map((size) => (
            <option key={size} value={size}>
              {size}{size in TRW_STONE_SIZE_CALIBRATION ? ` — ${TRW_STONE_SIZE_CALIBRATION[size as keyof typeof TRW_STONE_SIZE_CALIBRATION].diameterMm} mm` : ''}
            </option>
          ))}
        </select>
        {calibration && (
          <span className="text-[11px] text-ink-muted">
            Authoritative hole diameter: {calibration.diameterMm} mm
          </span>
        )}
        {selectedAlphabet.limitations && selectedAlphabet.limitations.length > 0 && (
          <span className="text-[11px] text-ink-muted">
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
        <div role="alert" className="rounded-xl border border-warning-500/30 bg-warning-50 px-3 py-3 text-xs text-warning-600">
          Unsupported characters: {svgAlphabetTool.unsupportedCharacters.join(', ')}
        </div>
      )}
    </div>
  );
}

function LetterStencilToolProperties({ state, dispatch }: ToolPropertiesProps) {
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
      <div className="rounded-xl border border-accent-300 bg-accent-50 px-3 py-3 text-xs text-accent-700">
        Generates a reusable stencil card per letter with an outer cut frame. I stays narrow, W stays wide, and every card keeps the same height so the machine cuts the card and the rhinestone holes together.
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">Glyph source</span>
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
            className={`rounded-xl border px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${letterStencilTool.sourceType === 'svg-alphabet' ? 'border-accent-400 bg-accent-50 text-ink' : 'border-border bg-surface-sunken text-ink-secondary hover:border-border hover:bg-surface-raised'}`}
          >
            <div className="font-medium">SVG Alphabet</div>
            <div className="mt-1 text-[10px] text-ink-muted">Curated per-letter SVG glyphs</div>
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
            className={`rounded-xl border px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${letterStencilTool.sourceType === 'rhinestone-font' ? 'border-accent-400 bg-accent-50 text-ink' : 'border-border bg-surface-sunken text-ink-secondary hover:border-border hover:bg-surface-raised'}`}
          >
            <div className="font-medium">Rhinestone Font</div>
            <div className="mt-1 text-[10px] text-ink-muted">Any registered OpenType rhinestone font</div>
          </button>
        </div>
      </div>

      {letterStencilTool.sourceType === 'svg-alphabet' ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-secondary">Alphabet</span>
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
            className="rounded border border-border bg-surface-sunken px-2 py-2 text-sm text-ink"
          >
            {availableAlphabets.map((alphabet) => (
              <option key={alphabet.alphabetId} value={alphabet.alphabetId}>
                {alphabet.displayName} — {alphabet.style}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-ink-muted">
            {selectedAlphabet.category} · {selectedAlphabet.style} · supports {selectedAlphabet.supportedTargetStoneSizeIds.join(', ')}
          </span>
        </label>
      ) : (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-secondary">Rhinestone font</span>
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
            className="rounded border border-border bg-surface-sunken px-2 py-2 text-sm text-ink"
          >
            {availableFonts.map((font) => (
              <option key={font.fontId} value={font.fontId}>
                {font.displayName} — {font.style}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-ink-muted">
            {selectedFont.category} · {selectedFont.style} · supports {selectedFont.supportedTargetStoneSizeIds.join(', ')}
          </span>
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">Text</span>
        <div className="flex items-center justify-between gap-3 text-[11px] text-ink-muted">
          <span>{cardCount} card{cardCount === 1 ? '' : 's'} · Suggested: {activeSource.suggestedText}</span>
          <button
            type="button"
            onClick={() => dispatch({
              type: 'UPDATE_LETTER_STENCIL_TOOL',
              updates: { text: activeSource.suggestedText },
            })}
            className="rounded-full border border-border px-2 py-1 text-[11px] text-ink-secondary transition hover:border-border-strong hover:bg-surface-sunken"
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
          className="resize-y rounded border border-border bg-surface-sunken px-2 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent-400"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">Stone size</span>
        <select
          aria-label="Stencil stone size"
          value={letterStencilTool.stoneSize}
          onChange={(e) => dispatch({
            type: 'UPDATE_LETTER_STENCIL_TOOL',
            updates: { stoneSize: e.target.value as typeof letterStencilTool.stoneSize },
          })}
          className="rounded border border-border bg-surface-sunken px-2 py-2 text-sm text-ink"
        >
          {supportedStoneSizes.map((size) => (
            <option key={size} value={size}>
              {size}{size in TRW_STONE_SIZE_CALIBRATION ? ` — ${TRW_STONE_SIZE_CALIBRATION[size as keyof typeof TRW_STONE_SIZE_CALIBRATION].diameterMm} mm` : ''}
            </option>
          ))}
        </select>
        {calibration && (
          <span className="text-[11px] text-ink-muted">
            Authoritative hole diameter: {calibration.diameterMm} mm
          </span>
        )}
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">Layout mode</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => dispatch({ type: 'UPDATE_LETTER_STENCIL_TOOL', updates: { layoutMode: 'preview' } })}
            className={`rounded-xl border px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${letterStencilTool.layoutMode === 'preview' ? 'border-accent-400 bg-accent-50 text-ink' : 'border-border bg-surface-sunken text-ink-secondary hover:border-border hover:bg-surface-raised'}`}
          >
            <div className="font-medium">Preview</div>
            <div className="mt-1 text-[10px] text-ink-muted">Cards edge-to-edge, for visual word preview only</div>
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'UPDATE_LETTER_STENCIL_TOOL', updates: { layoutMode: 'cut-sheet' } })}
            className={`rounded-xl border px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${letterStencilTool.layoutMode === 'cut-sheet' ? 'border-accent-400 bg-accent-50 text-ink' : 'border-border bg-surface-sunken text-ink-secondary hover:border-border hover:bg-surface-raised'}`}
          >
            <div className="font-medium">Cut sheet</div>
            <div className="mt-1 text-[10px] text-ink-muted">Framed cards with cut spacing, ready to cut</div>
          </button>
        </div>
        <span className="text-[11px] text-ink-muted">{modeCopy}</span>
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
        <div role="alert" className="rounded-xl border border-warning-500/30 bg-warning-50 px-3 py-3 text-xs text-warning-600">
          Unsupported characters: {letterStencilTool.unsupportedCharacters.join(', ')}
        </div>
      )}
    </div>
  );
}

function TemplateImportToolProperties({ state, dispatch }: ToolPropertiesProps) {
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
      <div className="rounded-xl border border-info-500/30 bg-info-50 px-3 py-3 text-xs text-info-600">
        Imports circles already positioned as stones. For a logo or ordinary
        vector shape, choose SVG Convert Shape instead.
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">Existing rhinestone template</span>
        <input
          aria-label="Existing rhinestone template"
          type="file"
          accept=".svg,image/svg+xml"
          onChange={handleFileSelect}
          className="text-xs text-ink-secondary file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-accent-500 file:px-3 file:py-2 file:text-xs file:font-medium file:text-ink-inverse hover:file:bg-accent-600"
        />
      </label>

      <StoneProfileControl
        value={templateImportTool.defaultStoneSize}
        onChange={(defaultStoneSize) => dispatch({
          type: 'UPDATE_TEMPLATE_IMPORT_TOOL',
          updates: { defaultStoneSize },
        })}
      />
      <p className="-mt-2 text-[11px] text-ink-muted">
        Fallback label only. Imported circle diameter remains unchanged.
      </p>

      {templateImportTool.importError && (
        <div role="alert" className="rounded-xl border border-danger-500/30 bg-danger-50 px-3 py-3 text-xs text-danger-600">
          {templateImportTool.importError}
        </div>
      )}

      {templateImportTool.pendingSvgText && (
        <div className="space-y-3 rounded-xl border border-border bg-surface-sunken px-3 py-3 text-xs text-ink-secondary">
          <p className="font-medium text-ink">{templateImportTool.importSummary}</p>
          <p>Diameters: {templateImportTool.detectedDiameters.join(', ')} mm</p>
          <p>Colors: {templateImportTool.detectedColors.join(', ') || 'none'}</p>
          <p>Ignored decorative elements: {templateImportTool.ignoredElements}</p>
          {templateImportTool.warnings.map((warning) => <p key={warning} className="text-warning-600">{warning}</p>)}
          <button
            type="button"
            onClick={confirmImport}
            className="w-full rounded-lg bg-accent-500 px-3 py-2 text-sm font-medium text-ink-inverse hover:bg-accent-600"
          >
            Import stones to canvas
          </button>
        </div>
      )}

      {templateImportTool.uploadedSvgText && (
        <p className="text-xs text-success-600">
          Imported: {templateImportTool.svgFileName ?? 'template.svg'}
        </p>
      )}
    </div>
  );
}

function SvgToolProperties({ state, dispatch }: ToolPropertiesProps) {
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
        <span className="text-xs font-medium text-ink-secondary">Upload artwork</span>
        <div
          tabIndex={0}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onPaste={handlePaste}
          className="rounded-xl border border-dashed border-border bg-surface-sunken px-4 py-4 text-center text-sm text-ink-secondary outline-none transition hover:border-border-strong focus:border-accent-400 focus:ring-1 focus:ring-accent-400"
        >
          <p>Drag and drop or paste artwork here.</p>
          <p className="mt-1 text-[11px] text-ink-muted">Use the file picker below if you prefer browsing.</p>
        </div>
        <input
          id={uploadInputId}
          type="file"
          accept=".svg,image/svg+xml,.png,.jpg,.jpeg,.webp,.bmp,.gif,image/png,image/jpeg,image/webp,image/bmp,image/gif"
          onChange={handleFileSelect}
          className="text-xs text-ink-secondary file:mr-3 file:px-3 file:py-2 file:rounded file:border-0 file:bg-accent-500 file:text-ink-inverse file:text-xs file:font-medium hover:file:bg-accent-600 file:cursor-pointer cursor-pointer"
        />
        <span className="text-[11px] text-ink-muted">Supports SVG, PNG, JPG, WEBP, BMP, and GIF.</span>
        {currentArtworkName && (
          <span className="text-xs text-ink-secondary mt-1">📄 {currentArtworkName}</span>
        )}
      </label>

      {svgTool.assetKind === 'image' && svgTool.uploadedImageDataUrl && (
        <>
          <div className="rounded-xl border border-accent-300 bg-accent-50 px-3 py-3 text-xs text-accent-700">
            Converts a raster image into a rhinestone layout using thresholded image sampling, color layers, and physical stone spacing.
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-surface-sunken">
            <div className="border-b border-border px-3 py-2 text-xs font-medium text-ink-secondary">Original image</div>
            <img
              src={svgTool.uploadedImageDataUrl}
              alt={currentArtworkName ?? 'Uploaded artwork preview'}
              className="max-h-56 w-full object-contain bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.14),_transparent_35%),linear-gradient(180deg,_#111827,_#09090b)]"
            />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium text-ink-secondary">Number of stone colors</span>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { imageColorCount: count as 1 | 2 | 3 | 4 } })}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${svgTool.imageColorCount === count ? 'border-accent-400 bg-accent-50 text-ink' : 'border-border bg-surface-sunken text-ink-secondary hover:border-border hover:bg-surface-raised'}`}
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
              <span className="text-xs font-medium text-ink-secondary">Target Dimensions</span>
              <div className="ml-auto inline-flex rounded-lg border border-border bg-surface-raised p-1 text-xs">
                {(['in', 'mm'] as const).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { dimensionUnit: unit } })}
                    className={`rounded px-2 py-1 transition ${displayUnit === unit ? 'bg-accent-500 text-ink-inverse' : 'text-ink-secondary hover:text-ink'}`}
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

            <label className="flex items-center gap-2 text-sm text-ink-secondary">
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

          <label className="flex items-center gap-2 text-sm text-ink-secondary">
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
            <span className="text-xs font-medium text-ink-secondary">SVG mode</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { renderMode: 'vector-layout' } })}
                className={`rounded-xl border px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${svgTool.renderMode === 'vector-layout' ? 'border-accent-400 bg-accent-50 text-ink' : 'border-border bg-surface-sunken text-ink-secondary hover:border-border hover:bg-surface-raised'}`}
              >
                <div className="font-medium">Vector layout</div>
                <div className="mt-1 text-[10px] text-ink-muted">Contour-aware placement from SVG paths</div>
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { renderMode: 'artwork-dots' } })}
                className={`rounded-xl border px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${svgTool.renderMode === 'artwork-dots' ? 'border-accent-400 bg-accent-50 text-ink' : 'border-border bg-surface-sunken text-ink-secondary hover:border-border hover:bg-surface-raised'}`}
              >
                <div className="font-medium">Artwork dots</div>
                <div className="mt-1 text-[10px] text-ink-muted">Dense fill-first sampling for logos and badges</div>
              </button>
            </div>
            <p className="text-[11px] text-ink-muted">
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
            <div className="rounded-xl border border-border bg-surface-sunken px-3 py-3 text-xs text-ink-secondary">
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
              <span className="text-sm text-ink-secondary">Enable Cleanup</span>
            </label>

            {svgTool.cleanupEnabled && (
              <div className="space-y-3 mt-3 pl-2 border-l-2 border-border">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={svgTool.cleanupSimplify}
                    onChange={(e) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { cleanupSimplify: e.target.checked } })}
                    className="h-3.5 w-3.5 rounded"
                  />
                  <span className="text-sm text-ink-secondary">Simplify (RDP)</span>
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
                  <span className="text-sm text-ink-secondary">Remove Tiny Lines</span>
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
                  <span className="text-sm text-ink-secondary">Deduplicate Points</span>
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

function GridToolProperties({ state, dispatch }: ToolPropertiesProps) {
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

function ManualToolProperties({ state, dispatch }: ToolPropertiesProps) {
  const { manualTool } = state;
  const recommendedDrawSpacingMm = getRecommendedCenterDistance(manualTool.addStoneSize);
  const selectAllStoneIds = state.editableTemplate.isEditable
    ? state.editableTemplate.stones.map((stone) => stone.id)
    : state.template?.stones.map((stone) => stone.id) ?? [];

  const handleMoveWholeDesign = () => {
    if (!state.editableTemplate.isEditable && state.template) {
      dispatch({ type: 'CONVERT_TO_EDITABLE' });
    }
    if (selectAllStoneIds.length > 0) {
      dispatch({ type: 'SET_SELECTED_STONES', ids: new Set(selectAllStoneIds) });
    }
    dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'select' });
  };
  
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface-sunken px-3 py-3 text-sm text-ink-secondary">
        <p className="font-medium text-ink">Pen tool</p>
        <p className="mt-1 text-xs text-ink-muted">Draw or erase directly on the canvas. Pen mode is now freehand by default, while the grid stays visible as a guide in the background.</p>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-medium text-ink-secondary">Tool mode</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => dispatch({ type: 'UPDATE_MANUAL_TOOL', updates: { interactionMode: 'place' } })}
            className={`rounded-xl border px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${manualTool.interactionMode === 'place' ? 'border-accent-400 bg-accent-50 text-ink' : 'border-border bg-surface-sunken text-ink-secondary hover:border-border hover:bg-surface-raised'}`}
          >
            <div className="font-medium">Place</div>
            <div className="mt-1 text-[10px] text-ink-muted">Click or drag to add stones</div>
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'UPDATE_MANUAL_TOOL', updates: { interactionMode: 'erase' } })}
            className={`rounded-xl border px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${manualTool.interactionMode === 'erase' ? 'border-danger-400 bg-danger-50 text-danger-600' : 'border-border bg-surface-sunken text-ink-secondary hover:border-border hover:bg-surface-raised'}`}
          >
            <div className="font-medium">Erase</div>
            <div className="mt-1 text-[10px] text-ink-muted">Click or drag to remove stones</div>
          </button>
        </div>
      </div>
      
      {/* Stone Size */}
      <StoneProfileControl
        value={manualTool.addStoneSize}
        onChange={(size) => dispatch({ type: 'UPDATE_MANUAL_TOOL', updates: { addStoneSize: size } })}
      />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_SELECTED_STONES', ids: new Set(selectAllStoneIds) })}
          disabled={selectAllStoneIds.length === 0}
          className="rounded-lg border border-border bg-surface-sunken px-3 py-2 text-xs font-medium text-ink transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={handleMoveWholeDesign}
          disabled={selectAllStoneIds.length === 0}
          className="rounded-lg border border-info-500/20 bg-info-50 px-3 py-2 text-xs font-medium text-info-600 transition hover:bg-info-500/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Move whole design
        </button>
      </div>

      <NumericInput
        label={manualTool.interactionMode === 'erase' ? 'Erase brush size' : 'Smart assist reach'}
        value={manualTool.assistBrushSizeMm}
        onChange={(val) => dispatch({ type: 'UPDATE_MANUAL_TOOL', updates: { assistBrushSizeMm: typeof val === 'number' ? val : manualTool.assistBrushSizeMm } })}
        unit="mm"
        min={2}
        max={60}
        step={0.5}
      />
      
      {/* Snap to Grid */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs font-medium text-ink-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={manualTool.snapToGrid}
            onChange={(e) => dispatch({ type: 'UPDATE_MANUAL_TOOL', updates: { snapToGrid: e.target.checked } })}
            className="rounded border-border bg-surface-sunken text-accent-600 focus:ring-accent-500 focus:ring-offset-0"
          />
          Snap to Grid
        </label>

        <div className="rounded-xl border border-border bg-surface-sunken px-3 py-3">
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
          {!manualTool.snapToGrid && <p className="mt-2 text-[11px] text-ink-muted">Enable Snap to Grid to adjust the placement step size.</p>}
        </div>
      </div>

      {!manualTool.snapToGrid && (
        <div className="rounded-xl border border-success-500/20 bg-success-50 px-3 py-3 text-[11px] text-success-600">
          Free draw is active. The grid is visual only until you enable snapping.
        </div>
      )}

      <label className="flex items-center gap-2 text-xs font-medium text-ink-secondary cursor-pointer">
        <input
          type="checkbox"
          checked={state.canvas.showRulers}
          onChange={(e) => dispatch({ type: 'UPDATE_CANVAS', updates: { showRulers: e.target.checked } })}
          className="rounded border-border bg-surface-sunken text-accent-600 focus:ring-accent-500 focus:ring-offset-0"
        />
        Show rulers in preview
      </label>

      <div className="rounded-xl border border-border bg-surface-sunken px-3 py-3 text-[11px] text-ink-muted">
        {manualTool.interactionMode === 'erase'
          ? 'Erase mode removes stones directly under the cursor path without switching to Select.'
          : `Draw mode uses about ${recommendedDrawSpacingMm.toFixed(1)} mm center-to-center spacing for ${manualTool.addStoneSize}. Smart assist can search about ${manualTool.assistBrushSizeMm.toFixed(1)} mm for a better spot.`}
      </div>
      
      <div className="pt-4 border-t border-border space-y-2">
        <p className="text-xs text-ink-secondary">Keyboard shortcuts:</p>
        <ul className="text-xs text-ink-muted space-y-1">
          <li>• Place mode: click one stone or drag a line</li>
          <li>• Erase mode: click or drag to remove stones</li>
          <li>• Move whole design selects everything and switches to Select</li>
        </ul>
      </div>
    </div>
  );
}

function SelectToolProperties({ state, dispatch }: ToolPropertiesProps) {
  const selectedCount = state.selectedStoneIds.size;
  const { editableTemplate } = state;
  const actionState = getSelectionActionState(selectedCount);
  const emptyState = getSelectionEmptyState(editableTemplate.isEditable);
  
  // Get selected stone(s) for position editing
  const selectedStone = selectedCount === 1 
    ? editableTemplate.stones.find(s => state.selectedStoneIds.has(s.id))
    : null;
  const allEditableStoneIds = editableTemplate.stones.map((stone) => stone.id);

  const handleSmartFixSelection = () => {
    if (!editableTemplate.isEditable || selectedCount === 0) return;
    const selectedIds = [...state.selectedStoneIds];
    const moveAccumulator: Array<{ id: string; toX: number; toY: number }> = [];
    let workingStones = editableTemplate.stones.map((stone) => ({ ...stone, center: { ...stone.center } }));

    for (const stoneId of selectedIds) {
      const current = workingStones.find((stone) => stone.id === stoneId);
      if (!current) continue;
      const corrected = findNearestValidStonePosition(
        current.center.x,
        current.center.y,
        current.holeDiameterMm / 2,
        workingStones,
        {
          excludeIds: [stoneId],
          snapToGrid: state.manualTool.snapToGrid,
          gridSizeMm: state.manualTool.gridSnapSize,
          searchStepMm: Math.max(getRecommendedCenterDistance(current.stoneSize) / 2, 1),
          maxRadiusMm: Math.max(state.manualTool.assistBrushSizeMm, getRecommendedCenterDistance(current.stoneSize)),
        },
      );
      if (!corrected) continue;
      if (corrected.x === current.center.x && corrected.y === current.center.y) continue;

      moveAccumulator.push({ id: stoneId, toX: corrected.x, toY: corrected.y });
      workingStones = workingStones.map((stone) =>
        stone.id === stoneId ? { ...stone, center: { x: corrected.x, y: corrected.y } } : stone,
      );
    }

    if (moveAccumulator.length > 0) {
      dispatch({ type: 'MOVE_STONES', moves: moveAccumulator });
    }
  };

  const handleCleanUpSelection = () => {
    if (!editableTemplate.isEditable || selectedCount < 3) return;
    const selectedStones = editableTemplate.stones.filter((stone) => state.selectedStoneIds.has(stone.id));
    if (selectedStones.length < 3) return;

    let workingStones = editableTemplate.stones.map((stone) => ({ ...stone, center: { ...stone.center } }));
    const spanX = Math.max(...selectedStones.map((stone) => stone.center.x)) - Math.min(...selectedStones.map((stone) => stone.center.x));
    const spanY = Math.max(...selectedStones.map((stone) => stone.center.y)) - Math.min(...selectedStones.map((stone) => stone.center.y));
    const primaryAxis: 'x' | 'y' = spanX >= spanY ? 'x' : 'y';
    const secondaryAxis: 'x' | 'y' = primaryAxis === 'x' ? 'y' : 'x';
    const ordered = [...selectedStones].sort((left, right) => left.center[primaryAxis] - right.center[primaryAxis]);
    const first = ordered[0]!;
    const last = ordered[ordered.length - 1]!;
    const targetSecondary = ordered.reduce((sum, stone) => sum + stone.center[secondaryAxis], 0) / ordered.length;
    const primarySpacing = ordered.length > 1
      ? (last.center[primaryAxis] - first.center[primaryAxis]) / (ordered.length - 1)
      : 0;
    const moves: Array<{ id: string; toX: number; toY: number }> = [];

    ordered.forEach((stone, index) => {
      const targetPrimary = first.center[primaryAxis] + primarySpacing * index;
      const desiredX = primaryAxis === 'x' ? targetPrimary : targetSecondary;
      const desiredY = primaryAxis === 'x' ? targetSecondary : targetPrimary;
      const corrected = findNearestValidStonePosition(
        desiredX,
        desiredY,
        stone.holeDiameterMm / 2,
        workingStones,
        {
          excludeIds: [stone.id],
          snapToGrid: state.manualTool.snapToGrid,
          gridSizeMm: state.manualTool.gridSnapSize,
          searchStepMm: Math.max(getRecommendedCenterDistance(stone.stoneSize) / 2, 1),
          maxRadiusMm: Math.max(state.manualTool.assistBrushSizeMm, getRecommendedCenterDistance(stone.stoneSize)),
        },
      );
      if (!corrected) return;
      if (corrected.x === stone.center.x && corrected.y === stone.center.y) return;
      moves.push({ id: stone.id, toX: corrected.x, toY: corrected.y });
      workingStones = workingStones.map((candidate) =>
        candidate.id === stone.id ? { ...candidate, center: { x: corrected.x, y: corrected.y } } : candidate,
      );
    });

    if (moves.length > 0) {
      dispatch({ type: 'MOVE_STONES', moves });
    }
  };

  return (
    <div className="space-y-4">
      {selectedCount === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-sunken px-4 py-4">
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <ScanSearch className="h-4 w-4 text-accent-600" />
            {emptyState.title}
          </div>
          <p className="mt-2 text-sm text-ink-secondary">{emptyState.description}</p>
          <ul className="mt-3 space-y-2 text-xs text-ink-muted">
            {emptyState.tips.map((tip) => (
              <li key={tip}>• {tip}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-sunken px-4 py-3">
          <p className="text-sm font-medium text-ink">{selectedCount} stone{selectedCount > 1 ? 's' : ''} selected</p>
          <p className="mt-1 text-xs text-ink-muted">Selection actions only affect the highlighted stones.</p>
        </div>
      )}
      
      {/* Single stone position editing */}
      {selectedStone && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-ink-secondary">Position</label>
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
        <NumericInput
          label="Smart fix brush size"
          value={state.manualTool.assistBrushSizeMm}
          onChange={(val) => dispatch({ type: 'UPDATE_MANUAL_TOOL', updates: { assistBrushSizeMm: typeof val === 'number' ? val : state.manualTool.assistBrushSizeMm } })}
          unit="mm"
          min={2}
          max={60}
          step={0.5}
        />

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => dispatch({ type: 'SET_SELECTED_STONES', ids: new Set(allEditableStoneIds) })}
            disabled={!editableTemplate.isEditable || allEditableStoneIds.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-sunken px-3 py-2 text-xs font-medium text-ink transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40"
            title={editableTemplate.isEditable ? 'Select all stones in the editable design.' : 'Make the design editable before selecting all stones.'}
          >
            Select all
          </button>
          <button
            onClick={() => dispatch({ type: 'DUPLICATE_STONES', stoneIds: Array.from(state.selectedStoneIds) })}
            disabled={!actionState.canDuplicate}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-sunken px-3 py-2 text-xs font-medium text-ink transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40"
            title={actionState.duplicateReason ?? 'Duplicate selected stones (Cmd/Ctrl+D)'}
          >
            <CopyPlus className="h-3.5 w-3.5" />
            Duplicate
          </button>
          <button
            onClick={() => dispatch({ type: 'DELETE_STONES', stoneIds: Array.from(state.selectedStoneIds) })}
            disabled={!actionState.canDelete}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-danger-500/20 bg-danger-50 px-3 py-2 text-xs font-medium text-danger-600 transition hover:bg-danger-500/15 disabled:cursor-not-allowed disabled:opacity-40"
            title={actionState.deleteReason ?? 'Delete selected stones (Delete/Backspace)'}
          >
            <DiamondMinus className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>

        <button
          onClick={handleSmartFixSelection}
          disabled={selectedCount === 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-success-500/20 bg-success-50 px-3 py-2 text-xs font-medium text-success-600 transition hover:bg-success-500/15 disabled:cursor-not-allowed disabled:opacity-40"
          title={selectedCount > 0 ? 'Try to nudge the selected stones to the nearest safe positions.' : 'Select at least one stone to auto-correct it.'}
        >
          Smart fix selection
        </button>

        <button
          onClick={handleCleanUpSelection}
          disabled={selectedCount < 3}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-info-500/20 bg-info-50 px-3 py-2 text-xs font-medium text-info-600 transition hover:bg-info-500/15 disabled:cursor-not-allowed disabled:opacity-40"
          title={selectedCount >= 3 ? 'Straighten the selection and even out spacing.' : 'Select at least three stones to clean up spacing.'}
        >
          Clean up selection
        </button>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-ink-secondary">Align</label>
            {!actionState.canAlign && <span className="text-[11px] text-ink-muted">Select at least two stones</span>}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button onClick={() => dispatch({ type: 'ALIGN_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'left' })} disabled={!actionState.canAlign} className="rounded-lg border border-border bg-surface-sunken px-2 py-2 text-xs text-ink transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40" title={actionState.alignReason ?? 'Align selected stones to the left'}><MoveHorizontal className="mx-auto h-3.5 w-3.5 rotate-180" /></button>
            <button onClick={() => dispatch({ type: 'ALIGN_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'center' })} disabled={!actionState.canAlign} className="rounded-lg border border-border bg-surface-sunken px-2 py-2 text-xs text-ink transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40" title={actionState.alignReason ?? 'Align selected stones to the center'}><MoveHorizontal className="mx-auto h-3.5 w-3.5" /></button>
            <button onClick={() => dispatch({ type: 'ALIGN_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'right' })} disabled={!actionState.canAlign} className="rounded-lg border border-border bg-surface-sunken px-2 py-2 text-xs text-ink transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40" title={actionState.alignReason ?? 'Align selected stones to the right'}><MoveHorizontal className="mx-auto h-3.5 w-3.5" /></button>
            <button onClick={() => dispatch({ type: 'ALIGN_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'top' })} disabled={!actionState.canAlign} className="rounded-lg border border-border bg-surface-sunken px-2 py-2 text-xs text-ink transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40" title={actionState.alignReason ?? 'Align selected stones to the top'}><MoveVertical className="mx-auto h-3.5 w-3.5 rotate-180" /></button>
            <button onClick={() => dispatch({ type: 'ALIGN_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'middle' })} disabled={!actionState.canAlign} className="rounded-lg border border-border bg-surface-sunken px-2 py-2 text-xs text-ink transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40" title={actionState.alignReason ?? 'Align selected stones to the vertical middle'}><MoveVertical className="mx-auto h-3.5 w-3.5" /></button>
            <button onClick={() => dispatch({ type: 'ALIGN_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'bottom' })} disabled={!actionState.canAlign} className="rounded-lg border border-border bg-surface-sunken px-2 py-2 text-xs text-ink transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40" title={actionState.alignReason ?? 'Align selected stones to the bottom'}><MoveVertical className="mx-auto h-3.5 w-3.5" /></button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-ink-secondary">Distribute</label>
            {!actionState.canDistribute && <span className="text-[11px] text-ink-muted">Select at least three stones</span>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => dispatch({ type: 'DISTRIBUTE_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'horizontal' })} disabled={!actionState.canDistribute} className="rounded-lg border border-border bg-surface-sunken px-3 py-2 text-xs text-ink transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40" title={actionState.distributeReason ?? 'Distribute selected stones horizontally'}>Horizontal</button>
            <button onClick={() => dispatch({ type: 'DISTRIBUTE_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'vertical' })} disabled={!actionState.canDistribute} className="rounded-lg border border-border bg-surface-sunken px-3 py-2 text-xs text-ink transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40" title={actionState.distributeReason ?? 'Distribute selected stones vertically'}>Vertical</button>
          </div>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="space-y-3">
          <div className="pt-3 border-t border-border text-xs text-ink-secondary space-y-1">
            <p className="font-medium">Selection Controls:</p>
            <ul className="text-ink-muted space-y-1">
              <li>• Drag to move</li>
              <li>• Cmd/Ctrl+A selects all stones</li>
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
        <div className="rounded-xl border border-accent-300 bg-accent-50 p-4">
          <button
            onClick={() => dispatch({ type: 'CONVERT_TO_EDITABLE' })}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent-500 px-3 py-2 text-sm font-medium text-ink-inverse transition hover:bg-accent-600"
            title="Convert the generated output into individually editable stones"
          >
            <Hand className="h-4 w-4" />
            Make Editable
          </button>
          <p className="mt-2 text-xs text-ink-secondary">
            Generated output is still driven by the source settings. Make Editable unlocks per-stone editing while keeping the original generator available.
          </p>
        </div>
      )}
      
      <div className="pt-4 border-t border-border space-y-2">
        <p className="text-xs text-ink-secondary">Keyboard shortcuts:</p>
        <ul className="text-xs text-ink-muted space-y-1">
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
