import { withStoneColour } from './stoneColours';
import { wouldCollide, wouldMoveCauseCollision } from './collisionDetection';
import { applyWorkspaceDefaults } from './newProjectDefaults';
import { alignDelta, alignDeltaY, isVerticalAlign, rotateStonesBy, spreadStones, boundsOfStones, offsetBelow, partsStones, transformStones, translateStones, translateTemplate, nextPartId, type DesignPart } from './designParts';
import { EditorAction, EditorState, HistoryEntry } from './editorState/types';
import { DEFAULT_EDITOR_STATE } from './editorState/defaults';
import { inferEditableSourceGenerator, normalizeRhinestoneFontToolUpdate, normalizeSvgToolUpdate, normalizeTextToolUpdate } from './editorState/normalize';
export * from './editorState/types';
export * from './editorState/defaults';
export * from './editorState/normalize';

const PARTS_HISTORY_LIMIT = 50;

/** New parts with the old ones kept for undo. The same `key` twice in a row (typing a position) is one step. */
function withPartsHistory(state: EditorState, parts: DesignPart[], key: string | null): EditorState {
  const { past, lastKey } = state.partsHistory;
  const merge = key !== null && key === lastKey;
  return {
    ...state,
    parts,
    partsHistory: {
      past: merge ? past : [...past, state.parts].slice(-PARTS_HISTORY_LIMIT),
      future: [],
      lastKey: key,
    },
  };
}

/** "YOUR NAME design": the words of the first line, so a design is never "Untitled Project" once it has text. */
export function projectNameFromText(text: string): string {
  const firstLine = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim()).find((line) => line.length > 0);
  if (!firstLine) return 'Untitled Project';
  const words = firstLine.length > 28 ? `${firstLine.slice(0, 27).trimEnd()}…` : firstLine;
  return `${words} design`;
}

function withAutoName(state: EditorState, text: string): EditorState {
  if (!state.projectNameIsAuto) return state;
  const name = projectNameFromText(text);
  return name === state.projectName ? state : { ...state, projectName: name };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_ACTIVE_TOOL':
      return { ...state, activeTool: action.tool };
    
    case 'SET_DESIGN_STONE_COLOUR':
      return { ...state, designStoneColour: action.colour };

    case 'SET_STONES_COLOUR': {
      if (!state.editableTemplate.isEditable || action.ids.length === 0) return state;
      const ids = new Set(action.ids);
      const historyEntry: HistoryEntry = { stones: state.editableTemplate.stones, selectedIds: new Set(state.selectedStoneIds) };
      return {
        ...state,
        editableTemplate: {
          ...state.editableTemplate,
          stones: state.editableTemplate.stones.map((stone) => (ids.has(stone.id) ? withStoneColour(stone, action.colour) : stone)),
        },
        history: { past: [...state.history.past, historyEntry], future: [] },
      };
    }

    case 'SET_PROJECT_NAME':
      return { ...state, projectName: action.name, projectNameIsAuto: action.auto === true };
    
    case 'UPDATE_TEXT_TOOL':
      return withAutoName(
        { ...state, textTool: normalizeTextToolUpdate(state.textTool, action.updates) },
        action.updates.text ?? state.textTool.text,
      );
    
    case 'UPDATE_SVG_TOOL':
      return { ...state, svgTool: normalizeSvgToolUpdate(state.svgTool, action.updates) };
    
    case 'UPDATE_GRID_TOOL':
      return { ...state, gridTool: { ...state.gridTool, ...action.updates } };
    
    case 'UPDATE_MANUAL_TOOL':
      return { ...state, manualTool: { ...state.manualTool, ...action.updates } };
    
    case 'UPDATE_RHINESTONE_FONT_TOOL':
      return withAutoName(
        {
          ...state,
          rhinestoneFontTool: normalizeRhinestoneFontToolUpdate(state.rhinestoneFontTool, action.updates),
        },
        action.updates.text ?? state.rhinestoneFontTool.text,
      );
    
    case 'UPDATE_SVG_ALPHABET_TOOL':
      return { ...state, svgAlphabetTool: { ...state.svgAlphabetTool, ...action.updates } };
    
    case 'UPDATE_LETTER_STENCIL_TOOL':
      return { ...state, letterStencilTool: { ...state.letterStencilTool, ...action.updates } };
    
    case 'UPDATE_TEMPLATE_IMPORT_TOOL':
      return { ...state, templateImportTool: { ...state.templateImportTool, ...action.updates } };
    
    case 'SET_TEMPLATE': {
      // Generation sets `null` again for every settings change on an empty design; no new state, no render.
      if (state.template === action.template) return state;
      // The generator always draws at its own origin; the piece's place in the design is applied here.
      const placed = action.template ? translateTemplate(action.template, state.workingOffset.x, state.workingOffset.y) : null;
      return { ...state, template: placed };
    }

    case 'ADD_PART':
      return withPartsHistory(state, [...state.parts, action.part], null);

    case 'REMOVE_PART':
      return withPartsHistory(state, state.parts.filter((part) => part.id !== action.id), null);

    case 'UPDATE_PART': {
      const moving = action.updates.offsetX !== undefined || action.updates.offsetY !== undefined;
      const parts = state.parts.map((part) => (part.id === action.id ? { ...part, ...action.updates } : part));
      // Renaming is not worth an undo step; typing a position is one step, not one per key.
      if (!moving) return { ...state, parts };
      return withPartsHistory(state, parts, `move:${action.id}`);
    }

    case 'TRANSFORM_PART':
      return withPartsHistory(
        state,
        state.parts.map((part) => (part.id === action.id ? { ...part, stones: transformStones(part.stones, action.op) } : part)),
        null,
      );

    case 'DUPLICATE_PART': {
      const source = state.parts.find((part) => part.id === action.id);
      if (!source) return state;
      // The copy goes below everything kept, left edges aligned, so it never lands on top of the original.
      const own = boundsOfStones(source.stones);
      const below = offsetBelow(partsStones(state.parts), own?.minY ?? 0, own?.minX ?? 0);
      const copy: DesignPart = {
        ...source,
        id: nextPartId(state.parts),
        name: `${source.name} copy`,
        offsetX: below.x,
        offsetY: below.y,
        stones: source.stones.map((stone) => ({ ...stone, center: { ...stone.center } })),
      };
      return withPartsHistory(state, [...state.parts, copy], null);
    }

    case 'END_PARTS_STEP':
      // The next move of a part starts a new undo step.
      return state.partsHistory.lastKey === null ? state : { ...state, partsHistory: { ...state.partsHistory, lastKey: null } };

    case 'ALIGN_PART': {
      const target = state.parts.find((part) => part.id === action.id);
      if (!target) return state;
      const workingStones = state.editableTemplate.isEditable ? state.editableTemplate.stones : state.template?.stones ?? [];
      const others = boundsOfStones([...workingStones, ...partsStones(state.parts.filter((part) => part.id !== action.id))]);
      const own = boundsOfStones(partsStones([target]));
      const dx = isVerticalAlign(action.align) ? 0 : alignDelta(own, others, action.align);
      const dy = isVerticalAlign(action.align) ? alignDeltaY(own, others, action.align) : 0;
      if (dx === 0 && dy === 0) return state;
      return withPartsHistory(
        state,
        state.parts.map((part) => (part.id === action.id ? { ...part, offsetX: Math.round((part.offsetX + dx) * 1e4) / 1e4, offsetY: Math.round((part.offsetY + dy) * 1e4) / 1e4 } : part)),
        null,
      );
    }

    case 'ALIGN_WORKING': {
      const workingStones = state.editableTemplate.isEditable ? state.editableTemplate.stones : state.template?.stones ?? [];
      const own = boundsOfStones(workingStones);
      const others = boundsOfStones(partsStones(state.parts));
      const dx = isVerticalAlign(action.align) ? 0 : alignDelta(own, others, action.align);
      const dy = isVerticalAlign(action.align) ? alignDeltaY(own, others, action.align) : 0;
      if (dx === 0 && dy === 0) return state;
      return editorReducer(state, { type: 'SET_WORKING_OFFSET', x: Math.round((state.workingOffset.x + dx) * 1e4) / 1e4, y: Math.round((state.workingOffset.y + dy) * 1e4) / 1e4 });
    }

    case 'TURN_PART_BY':
      if (!Number.isFinite(action.degrees) || action.degrees % 360 === 0) return state;
      return withPartsHistory(
        state,
        state.parts.map((part) => (part.id === action.id ? { ...part, stones: rotateStonesBy(part.stones, action.degrees) } : part)),
        null,
      );

    case 'SPREAD_PART':
      if (!Number.isFinite(action.factor) || action.factor <= 1) return state;
      return withPartsHistory(
        state,
        state.parts.map((part) => (part.id === action.id ? { ...part, stones: spreadStones(part.stones, action.factor) } : part)),
        null,
      );

    case 'EDIT_PART': {
      const part = state.parts.find((candidate) => candidate.id === action.id);
      if (!part) return state;
      const working = state.editableTemplate.isEditable ? state.editableTemplate.stones : state.template?.stones ?? [];
      if (working.length > 0) return state; // there is a piece in progress: it has to be added to the design first
      const stones = part.stones.map((stone) => ({
        ...stone,
        center: { x: Math.round((stone.center.x + part.offsetX) * 1e4) / 1e4, y: Math.round((stone.center.y + part.offsetY) * 1e4) / 1e4 },
      }));
      const next = withPartsHistory(state, state.parts.filter((candidate) => candidate.id !== action.id), null);
      return {
        ...next,
        activeTool: 'select',
        workingOffset: { x: 0, y: 0 },
        selectedStoneIds: new Set(),
        editableTemplate: { isEditable: true, stones, originalTemplate: null, sourceGenerator: 'manual-editor' },
        history: { past: [], future: [] },
      };
    }

    case 'UNDO_PARTS': {
      const past = state.partsHistory.past;
      if (past.length === 0) return state;
      return {
        ...state,
        parts: past[past.length - 1]!,
        partsHistory: { past: past.slice(0, -1), future: [state.parts, ...state.partsHistory.future], lastKey: null },
      };
    }

    case 'REDO_PARTS': {
      const future = state.partsHistory.future;
      if (future.length === 0) return state;
      return {
        ...state,
        parts: future[0]!,
        partsHistory: { past: [...state.partsHistory.past, state.parts], future: future.slice(1), lastKey: null },
      };
    }

    case 'SET_PARTS':
      return { ...state, parts: action.parts, workingOffset: action.workingOffset, partsHistory: { past: [], future: [], lastKey: null } };

    case 'SET_WORKING_OFFSET': {
      // Move the piece being worked on by the difference, wherever its stones are (generated or already editable).
      const dx = action.x - state.workingOffset.x;
      const dy = action.y - state.workingOffset.y;
      if (dx === 0 && dy === 0) return state;
      const editable = state.editableTemplate;
      return {
        ...state,
        workingOffset: { x: action.x, y: action.y },
        template: state.template ? translateTemplate(state.template, dx, dy) : null,
        editableTemplate: editable.isEditable
          ? {
              ...editable,
              stones: translateStones(editable.stones, dx, dy),
              originalTemplate: editable.originalTemplate ? translateTemplate(editable.originalTemplate, dx, dy) : null,
            }
          : editable,
      };
    }
    
    case 'UPDATE_CANVAS':
      return { ...state, canvas: { ...state.canvas, ...action.updates } };
    
    case 'UPDATE_EXPORT_SETTINGS':
      return { ...state, ...action.updates };
    
    case 'SET_SELECTED_STONES':
      return { ...state, selectedStoneIds: action.ids };
    
    case 'CONVERT_TO_EDITABLE': {
      if (!state.template) return state;
      
      // Save current state to history before converting
      const historyEntry: HistoryEntry = {
        stones: state.editableTemplate.stones,
        selectedIds: new Set(state.selectedStoneIds),
      };
      
      return {
        ...state,
        editableTemplate: {
          isEditable: true,
          stones: state.template.stones.map(s => ({ ...s })),
          originalTemplate: state.template,
          sourceGenerator: inferEditableSourceGenerator(state),
        },
        history: {
          past: [...state.history.past, historyEntry],
          future: [],
        },
      };
    }
    
    case 'RESTORE_EDITABLE': {
      // Restore editable state from saved project (don't create history)
      return {
        ...state,
        editableTemplate: {
          isEditable: true,
          stones: action.stones,
          originalTemplate: state.template,
          sourceGenerator: action.sourceGenerator,
        },
        selectedStoneIds: new Set(),
        history: {
          past: [],
          future: [],
        },
      };
    }

    case 'DISCARD_EDITABLE_CHANGES': {
      return {
        ...state,
        editableTemplate: {
          isEditable: false,
          stones: [],
          originalTemplate: null,
          sourceGenerator: null,
        },
        selectedStoneIds: new Set(),
        history: {
          past: [],
          future: [],
        },
      };
    }
    
    case 'ADD_STONES': {
      if (!state.editableTemplate.isEditable) return state;

      const prospectiveStones = [...state.editableTemplate.stones];
      for (const stone of action.stones) {
        const collision = wouldCollide(
          stone.center.x,
          stone.center.y,
          stone.holeDiameterMm / 2,
          prospectiveStones,
        );
        if (collision.collides) {
          return state;
        }
        prospectiveStones.push(stone);
      }
      
      const historyEntry: HistoryEntry = {
        stones: state.editableTemplate.stones,
        selectedIds: new Set(state.selectedStoneIds),
      };
      
      return {
        ...state,
        editableTemplate: {
          ...state.editableTemplate,
          stones: [...state.editableTemplate.stones, ...action.stones],
        },
        history: {
          past: [...state.history.past, historyEntry],
          future: [],
        },
      };
    }
    
    case 'REPLACE_STONES': {
      if (!state.template && !state.editableTemplate.isEditable) return state;

      const wasEditable = state.editableTemplate.isEditable;
      // Undo must bring back the stones as they were before the fix, also when the design was generated.
      const stonesBefore = wasEditable
        ? state.editableTemplate.stones
        : (state.template?.stones ?? []).map((stone) => ({ ...stone }));
      const historyEntry: HistoryEntry = {
        stones: stonesBefore,
        selectedIds: new Set(state.selectedStoneIds),
      };

      return {
        ...state,
        editableTemplate: wasEditable
          ? { ...state.editableTemplate, stones: action.stones }
          : {
              isEditable: true,
              stones: action.stones,
              originalTemplate: state.template,
              sourceGenerator: inferEditableSourceGenerator(state),
            },
        selectedStoneIds: new Set(
          [...state.selectedStoneIds].filter((id) => action.stones.some((stone) => stone.id === id)),
        ),
        history: {
          past: [...state.history.past, historyEntry],
          future: [],
        },
      };
    }

    case 'DELETE_STONES': {
      if (!state.editableTemplate.isEditable) return state;
      
      const deleteIds = new Set(action.stoneIds);
      const historyEntry: HistoryEntry = {
        stones: state.editableTemplate.stones,
        selectedIds: new Set(state.selectedStoneIds),
      };
      
      return {
        ...state,
        editableTemplate: {
          ...state.editableTemplate,
          stones: state.editableTemplate.stones.filter(s => !deleteIds.has(s.id)),
        },
        selectedStoneIds: new Set(
          [...state.selectedStoneIds].filter(id => !deleteIds.has(id))
        ),
        history: {
          past: [...state.history.past, historyEntry],
          future: [],
        },
      };
    }
    
    case 'MOVE_STONES': {
      if (!state.editableTemplate.isEditable) return state;

      if (action.moves.every((move) => {
        const currentStone = state.editableTemplate.stones.find((stone) => stone.id === move.id);
        return currentStone && currentStone.center.x === move.toX && currentStone.center.y === move.toY;
      })) {
        return state;
      }

      const moveCollision = wouldMoveCauseCollision(action.moves, state.editableTemplate.stones);
      if (moveCollision.collides) return state;
      
      const moveMap = new Map(action.moves.map(m => [m.id, { x: m.toX, y: m.toY }]));
      const historyEntry: HistoryEntry = {
        stones: state.editableTemplate.stones,
        selectedIds: new Set(state.selectedStoneIds),
      };
      
      return {
        ...state,
        editableTemplate: {
          ...state.editableTemplate,
          stones: state.editableTemplate.stones.map(stone => {
            const newPos = moveMap.get(stone.id);
            return newPos ? { ...stone, center: { x: newPos.x, y: newPos.y } } : stone;
          }),
        },
        history: {
          past: [...state.history.past, historyEntry],
          future: [],
        },
      };
    }
    
    case 'UPDATE_STONE': {
      if (!state.editableTemplate.isEditable) return state;

      const currentStone = state.editableTemplate.stones.find((stone) => stone.id === action.id);
      if (!currentStone) return state;

      const nextStone = { ...currentStone, ...action.updates };
      if ('center' in action.updates || 'holeDiameterMm' in action.updates) {
        const collision = wouldCollide(
          nextStone.center.x,
          nextStone.center.y,
          nextStone.holeDiameterMm / 2,
          state.editableTemplate.stones,
          [action.id],
        );
        if (collision.collides) return state;
      }
      
      const historyEntry: HistoryEntry = {
        stones: state.editableTemplate.stones,
        selectedIds: new Set(state.selectedStoneIds),
      };
      
      return {
        ...state,
        editableTemplate: {
          ...state.editableTemplate,
          stones: state.editableTemplate.stones.map(stone =>
            stone.id === action.id ? { ...stone, ...action.updates } : stone
          ),
        },
        history: {
          past: [...state.history.past, historyEntry],
          future: [],
        },
      };
    }
    
    case 'UNDO': {
      if (state.history.past.length === 0) return state;
      
      const lastEntry = state.history.past[state.history.past.length - 1];
      
      return {
        ...state,
        editableTemplate: {
          ...state.editableTemplate,
          stones: lastEntry.stones,
        },
        selectedStoneIds: lastEntry.selectedIds,
        history: {
          past: state.history.past.slice(0, -1),
          future: [
            {
              stones: state.editableTemplate.stones,
              selectedIds: new Set(state.selectedStoneIds),
            },
            ...state.history.future,
          ],
        },
      };
    }
    
    case 'REDO': {
      if (state.history.future.length === 0) return state;
      
      const nextEntry = state.history.future[0];
      
      return {
        ...state,
        editableTemplate: {
          ...state.editableTemplate,
          stones: nextEntry.stones,
        },
        selectedStoneIds: nextEntry.selectedIds,
        history: {
          past: [
            ...state.history.past,
            {
              stones: state.editableTemplate.stones,
              selectedIds: new Set(state.selectedStoneIds),
            },
          ],
          future: state.history.future.slice(1),
        },
      };
    }
    
    case 'DUPLICATE_STONES': {
      if (!state.editableTemplate.isEditable) return state;
      if (action.stoneIds.length === 0) return state;
      
      const historyEntry: HistoryEntry = {
        stones: state.editableTemplate.stones,
        selectedIds: new Set(state.selectedStoneIds),
      };
      
      // Duplicate selected stones with offset
      const stonesToDuplicate = state.editableTemplate.stones.filter(s => action.stoneIds.includes(s.id));
      const duplicatedStones = stonesToDuplicate.map(stone => ({
        ...stone,
        id: `stone-${Date.now()}-${Math.random()}`,
        center: { x: stone.center.x + 5, y: stone.center.y + 5 }, // 5mm offset
      }));
      
      const newSelectedIds = new Set(duplicatedStones.map(s => s.id));
      
      return {
        ...state,
        editableTemplate: {
          ...state.editableTemplate,
          stones: [...state.editableTemplate.stones, ...duplicatedStones],
        },
        selectedStoneIds: newSelectedIds,
        history: {
          past: [...state.history.past, historyEntry],
          future: [],
        },
      };
    }
    
    case 'COPY_STONES': {
      if (!state.editableTemplate.isEditable) return state;
      if (action.stoneIds.length === 0) return state;
      
      const stonesToCopy = state.editableTemplate.stones.filter(s => action.stoneIds.includes(s.id));
      
      return {
        ...state,
        clipboard: {
          stones: stonesToCopy.map(s => ({ ...s })),
        },
      };
    }
    
    case 'PASTE_STONES': {
      if (!state.editableTemplate.isEditable) return state;
      if (state.clipboard.stones.length === 0) return state;
      
      const historyEntry: HistoryEntry = {
        stones: state.editableTemplate.stones,
        selectedIds: new Set(state.selectedStoneIds),
      };
      
      // Paste with offset
      const pastedStones = state.clipboard.stones.map(stone => ({
        ...stone,
        id: `stone-${Date.now()}-${Math.random()}`,
        center: { x: stone.center.x + 10, y: stone.center.y + 10 }, // 10mm offset
      }));
      
      const newSelectedIds = new Set(pastedStones.map(s => s.id));
      
      return {
        ...state,
        editableTemplate: {
          ...state.editableTemplate,
          stones: [...state.editableTemplate.stones, ...pastedStones],
        },
        selectedStoneIds: newSelectedIds,
        history: {
          past: [...state.history.past, historyEntry],
          future: [],
        },
      };
    }
    
    case 'ALIGN_STONES': {
      if (!state.editableTemplate.isEditable) return state;
      if (action.stoneIds.length < 2) return state;
      
      const historyEntry: HistoryEntry = {
        stones: state.editableTemplate.stones,
        selectedIds: new Set(state.selectedStoneIds),
      };
      
      const selectedStones = state.editableTemplate.stones.filter(s => action.stoneIds.includes(s.id));
      
      // Calculate alignment target
      let alignValue = 0;
      if (action.direction === 'left') {
        alignValue = Math.min(...selectedStones.map(s => s.center.x));
      } else if (action.direction === 'right') {
        alignValue = Math.max(...selectedStones.map(s => s.center.x));
      } else if (action.direction === 'center') {
        const minX = Math.min(...selectedStones.map(s => s.center.x));
        const maxX = Math.max(...selectedStones.map(s => s.center.x));
        alignValue = (minX + maxX) / 2;
      } else if (action.direction === 'top') {
        alignValue = Math.min(...selectedStones.map(s => s.center.y));
      } else if (action.direction === 'bottom') {
        alignValue = Math.max(...selectedStones.map(s => s.center.y));
      } else if (action.direction === 'middle') {
        const minY = Math.min(...selectedStones.map(s => s.center.y));
        const maxY = Math.max(...selectedStones.map(s => s.center.y));
        alignValue = (minY + maxY) / 2;
      }
      
      const selectedIds = new Set(action.stoneIds);
      const alignedStones = state.editableTemplate.stones.map(stone => {
        if (!selectedIds.has(stone.id)) return stone;
        
        if (action.direction === 'left' || action.direction === 'center' || action.direction === 'right') {
          return { ...stone, center: { ...stone.center, x: alignValue } };
        } else {
          return { ...stone, center: { ...stone.center, y: alignValue } };
        }
      });
      
      return {
        ...state,
        editableTemplate: {
          ...state.editableTemplate,
          stones: alignedStones,
        },
        history: {
          past: [...state.history.past, historyEntry],
          future: [],
        },
      };
    }
    
    case 'DISTRIBUTE_STONES': {
      if (!state.editableTemplate.isEditable) return state;
      if (action.stoneIds.length < 3) return state;
      
      const historyEntry: HistoryEntry = {
        stones: state.editableTemplate.stones,
        selectedIds: new Set(state.selectedStoneIds),
      };
      
      const selectedStones = state.editableTemplate.stones.filter(s => action.stoneIds.includes(s.id));
      
      // Sort stones by position
      const sortedStones = [...selectedStones].sort((a, b) => {
        if (action.direction === 'horizontal') {
          return a.center.x - b.center.x;
        } else {
          return a.center.y - b.center.y;
        }
      });
      
      // Calculate spacing
      const first = sortedStones[0];
      const last = sortedStones[sortedStones.length - 1];
      const totalDistance = action.direction === 'horizontal'
        ? last.center.x - first.center.x
        : last.center.y - first.center.y;
      const spacing = totalDistance / (sortedStones.length - 1);
      
      // Create map of new positions
      const positionMap = new Map<string, { x: number; y: number }>();
      sortedStones.forEach((stone, index) => {
        if (index === 0 || index === sortedStones.length - 1) {
          // Keep first and last in place
          positionMap.set(stone.id, { x: stone.center.x, y: stone.center.y });
        } else {
          if (action.direction === 'horizontal') {
            positionMap.set(stone.id, {
              x: first.center.x + spacing * index,
              y: stone.center.y,
            });
          } else {
            positionMap.set(stone.id, {
              x: stone.center.x,
              y: first.center.y + spacing * index,
            });
          }
        }
      });
      
      const distributedStones = state.editableTemplate.stones.map(stone => {
        const newPos = positionMap.get(stone.id);
        return newPos ? { ...stone, center: newPos } : stone;
      });
      
      return {
        ...state,
        editableTemplate: {
          ...state.editableTemplate,
          stones: distributedStones,
        },
        history: {
          past: [...state.history.past, historyEntry],
          future: [],
        },
      };
    }
    
    case 'LOAD_PROJECT_STATE':
      return { ...state, ...action.state };
    
    case 'APPLY_WORKSPACE_DEFAULTS':
      return applyWorkspaceDefaults(state, action.settings);

    case 'RESET_EDITOR':
      return { ...DEFAULT_EDITOR_STATE };
    
    default:
      return state;
  }
}
