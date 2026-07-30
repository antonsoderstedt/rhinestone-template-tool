'use client';

import { EditorTool, EditorState, EditorAction } from './EditorState';
import StoneProfileControl from './controls/StoneProfileControl';
import DensityControl from './controls/DensityControl';
import PhysicalDimensionsControl from './controls/PhysicalDimensionsControl';
import NumericInput from './controls/NumericInput';
import AdvancedSection from './controls/AdvancedSection';
import FillModeControl from './controls/FillModeControl';

interface EditorPropertiesPanelProps {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

export default function EditorPropertiesPanel({ state, dispatch }: EditorPropertiesPanelProps) {
  const { activeTool } = state;

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
      <p className="text-sm text-zinc-300">Click on the canvas to add stones</p>
      
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
        
        {manualTool.snapToGrid && (
          <NumericInput
            label="Grid Size (mm)"
            value={manualTool.gridSnapSize}
            onChange={(val) => dispatch({ type: 'UPDATE_MANUAL_TOOL', updates: { gridSnapSize: val as number } })}
            min={1}
            max={50}
            step={1}
            unit="mm"
          />
        )}
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
  
  // Get selected stone(s) for position editing
  const selectedStone = selectedCount === 1 
    ? editableTemplate.stones.find(s => state.selectedStoneIds.has(s.id))
    : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-300">
        {selectedCount === 0 ? 'No stones selected' : `${selectedCount} stone${selectedCount > 1 ? 's' : ''} selected`}
      </p>
      
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
        </div>
      )}
      
      {selectedCount > 0 && (
        <div className="space-y-3">
          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => dispatch({ type: 'DUPLICATE_STONES', stoneIds: Array.from(state.selectedStoneIds) })}
              className="px-3 py-2 text-xs font-medium bg-zinc-700 text-white hover:bg-zinc-600 rounded transition"
              title="Duplicate (Ctrl/Cmd+D)"
            >
              Duplicate
            </button>
            <button
              onClick={() => dispatch({ type: 'DELETE_STONES', stoneIds: Array.from(state.selectedStoneIds) })}
              className="px-3 py-2 text-xs font-medium bg-red-600 text-white hover:bg-red-700 rounded transition"
              title="Delete (Del/Backspace)"
            >
              Delete
            </button>
          </div>
          
          {/* Align buttons (require 2+ stones) */}
          {selectedCount >= 2 && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-400">Align</label>
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={() => dispatch({ type: 'ALIGN_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'left' })}
                  className="px-2 py-1.5 text-xs bg-zinc-700 text-white hover:bg-zinc-600 rounded transition"
                  title="Align left"
                >
                  ⇤
                </button>
                <button
                  onClick={() => dispatch({ type: 'ALIGN_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'center' })}
                  className="px-2 py-1.5 text-xs bg-zinc-700 text-white hover:bg-zinc-600 rounded transition"
                  title="Align center"
                >
                  ↔
                </button>
                <button
                  onClick={() => dispatch({ type: 'ALIGN_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'right' })}
                  className="px-2 py-1.5 text-xs bg-zinc-700 text-white hover:bg-zinc-600 rounded transition"
                  title="Align right"
                >
                  ⇥
                </button>
                <button
                  onClick={() => dispatch({ type: 'ALIGN_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'top' })}
                  className="px-2 py-1.5 text-xs bg-zinc-700 text-white hover:bg-zinc-600 rounded transition"
                  title="Align top"
                >
                  ⤒
                </button>
                <button
                  onClick={() => dispatch({ type: 'ALIGN_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'middle' })}
                  className="px-2 py-1.5 text-xs bg-zinc-700 text-white hover:bg-zinc-600 rounded transition"
                  title="Align middle"
                >
                  ↕
                </button>
                <button
                  onClick={() => dispatch({ type: 'ALIGN_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'bottom' })}
                  className="px-2 py-1.5 text-xs bg-zinc-700 text-white hover:bg-zinc-600 rounded transition"
                  title="Align bottom"
                >
                  ⤓
                </button>
              </div>
            </div>
          )}
          
          {/* Distribute buttons (require 3+ stones) */}
          {selectedCount >= 3 && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-400">Distribute</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => dispatch({ type: 'DISTRIBUTE_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'horizontal' })}
                  className="px-2 py-1.5 text-xs bg-zinc-700 text-white hover:bg-zinc-600 rounded transition"
                  title="Distribute horizontally"
                >
                  ⟷ Horizontal
                </button>
                <button
                  onClick={() => dispatch({ type: 'DISTRIBUTE_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'vertical' })}
                  className="px-2 py-1.5 text-xs bg-zinc-700 text-white hover:bg-zinc-600 rounded transition"
                  title="Distribute vertically"
                >
                  ⟱ Vertical
                </button>
              </div>
            </div>
          )}
          
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
        <div className="pt-4 border-t border-zinc-700">
          <button
            onClick={() => dispatch({ type: 'CONVERT_TO_EDITABLE' })}
            className="w-full px-3 py-2 text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 rounded transition"
          >
            Make Editable
          </button>
          <p className="text-xs text-zinc-500 mt-2">
            Convert this generated template to editable mode to select and modify individual stones.
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
    case 'select': return 'Select & Move';
    case 'text': return 'Text Tool';
    case 'svg': return 'SVG Import';
    case 'grid': return 'Grid Generator';
    case 'manual': return 'Add Stones';
  }
}
