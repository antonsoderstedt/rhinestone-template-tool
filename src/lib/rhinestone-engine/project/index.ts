/**
 * Project save/load — public API.
 *
 * Re-exports from projectFormat.ts for convenience.
 */

export type {
  GeneratorId,
  PolylineDemoShape,
  OutlineTextProjectState,
  DotMatrixTextProjectState,
  ManualGridProjectState,
  PolylineLogoProjectState,
  SvgUploadProjectState,
  SavedStone,
  EditableTemplateState,
  ManualEditorProjectState,
  GeneratorProjectState,
  RhinestoneProjectFile,
} from './projectFormat';

export {
  parseRhinestoneProject,
  serializeRhinestoneProject,
} from './projectFormat';
