export type {
  TemplateEditOperationType,
  TemplateEditOperation,
  TemplateEditHistory,
  TemplateEditorOptions,
  CreateStoneAtPointOptions,
} from './templateEditor';
export {
  createEditHistory,
  commitEditedTemplate,
  undoEdit,
  redoEdit,
  findStoneById,
  generateManualStoneId,
  addStoneToTemplate,
  removeStoneFromTemplate,
  applyTemplateEditOperation,
  createStoneAtPoint,
} from './templateEditor';
