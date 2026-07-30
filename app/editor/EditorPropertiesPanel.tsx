'use client';

import { CopyPlus, DiamondMinus, Hand, Layers3, MoveHorizontal, MoveVertical, PenLine, Plus, ScanSearch, Sparkles, Type, Upload } from 'lucide-react';
import { getStoneSizeProfile } from '@/src/lib/rhinestone-engine/index';
import { EditorTool, EditorState, EditorAction } from './EditorState';
import StoneProfileControl from './controls/StoneProfileControl';
import DensityControl from './controls/DensityControl';
import PhysicalDimensionsControl from './controls/PhysicalDimensionsControl';
import NumericInput from './controls/NumericInput';
import AdvancedSection from './controls/AdvancedSection';
import FillModeControl from './controls/FillModeControl';
import { getEditableStatusCopy, getSelectionActionState, getSelectionEmptyState, getSourcePanelTool, type SourcePanelTool } from './editorUi';

interface EditorPropertiesPanelProps {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  mode?: 'combined' | 'source' | 'inspector';
}

const SOURCE_TOOL_CONFIG: Array<{ id: SourcePanelTool; label: string; description: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'text', label: 'Text', description: 'Outline or dot-matrix text', icon: Type },
  { id: 'svg', label: 'SVG', description: 'Upload vector artwork', icon: Upload },
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

export default function EditorPropertiesPanel({ state, dispatch, mode = 'combined' }: EditorPropertiesPanelProps) {
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
            {sourceTool === 'text' && <TextToolProperties state={state} dispatch={dispatch} />}
            {sourceTool === 'svg' && <SvgToolProperties state={state} dispatch={dispatch} />}
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
        {activeTool === 'svg' && <SvgToolProperties state={state} dispatch={dispatch} />}
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

function TextToolProperties({ state, dispatch }: EditorPropertiesPanelProps) {
  const { textTool } = state;

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
        <FillModeControl
          fillMode={textTool.fillMode}
          fillPattern={textTool.fillPattern}
          onFillModeChange={(mode) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { fillMode: mode } })}
          onFillPatternChange={(pattern) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { fillPattern: pattern } })}
        />
      </AdvancedSection>
    </div>
  );
}

function SvgToolProperties({ state, dispatch }: EditorPropertiesPanelProps) {
  const { svgTool } = state;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const svgText = reader.result as string;
      dispatch({
        type: 'UPDATE_SVG_TOOL',
        updates: {
          uploadedSvgText: svgText,
          svgFileName: file.name,
        },
      });
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset for re-upload
  };

  return (
    <div className="space-y-4">
      {/* File Upload */}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-400">Upload SVG</span>
        <input
          type="file"
          accept=".svg"
          onChange={handleFileSelect}
          className="text-xs text-zinc-300 file:mr-3 file:px-3 file:py-2 file:rounded file:border-0 file:bg-purple-600 file:text-white file:text-xs file:font-medium hover:file:bg-purple-700 file:cursor-pointer cursor-pointer"
        />
        {svgTool.svgFileName && (
          <span className="text-xs text-zinc-400 mt-1">📄 {svgTool.svgFileName}</span>
        )}
      </label>

      {svgTool.uploadedSvgText && (
        <>
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

          {/* Fill Mode */}
          <FillModeControl
            fillMode={svgTool.fillMode}
            fillPattern={svgTool.fillPattern}
            onFillModeChange={(mode) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { fillMode: mode } })}
            onFillPatternChange={(pattern) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { fillPattern: pattern } })}
          />

          {/* Density */}
          <DensityControl
            densityPreset={svgTool.densityPreset}
            customSpacingMm={svgTool.customSpacingMm}
            onDensityChange={(preset) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { densityPreset: preset } })}
            onCustomSpacingChange={(val) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { customSpacingMm: val } })}
          />

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
    case 'svg': return 'SVG Source';
    case 'grid': return 'Grid Source';
    case 'manual': return 'Manual Source';
  }
}
