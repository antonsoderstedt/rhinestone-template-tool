export * from './types';
export { buildSolid, planarCoordinates, type BuildOptions } from './mesh/build';
export { parseObj, parseStl, readMeshFile, MeshReadError } from './mesh/readers';
export * as shapes from './mesh/shapes';
export { BUILT_IN_SHAPES } from './mesh/shapes';
export { extrudeShape, latheShape, shapeOutline, simplifyOutline, rasterizeShape, type ShapeRegion, type OutlineResult } from './mesh/outline';
export { extrudeFaces, ringSweep, type LimbStep, type LimbOp, type RingSection, type RingSweep, type RingProfile } from './mesh/limbs';
export {
  PART_KINDS, PART_OPENS, PART_LIMITS, PARAMETRIC_TEMPLATES, defaultPart, clampPart, partMesh, buildParts, findTemplate, templateValues,
  partsOfRecipe, meshOfRecipe, recipeOfTemplate, longestSide,
  type BuildPart, type PartKind, type PartOpen, type ParametricTemplate, type TemplateParam, type ModelRecipe,
} from './mesh/builder';
export { simplifyMesh, type SimplifyOptions, type SimplifyResult } from './mesh/simplify';
export { fillHoles, flipFaces, boundaryLoops, type FillHolesResult } from './mesh/repair';
export { reportSolid, scaleMesh, findTinyEdges, type SolidReport, type ScaleTarget } from './mesh/inspect';
export { unfold, type UnfoldOptions, type UnfoldResult } from './unfold/unfold';
export { buildOrderOf } from './unfold/buildOrder';
export { buildPattern, buildPatternWithRule, foldKindOfEdge, patternScore, rulesToTry, UNFOLD_RULES } from './unfold/pattern';
export { buildFoldTree, foldPoses, faceTriangles, applyMat4, multiplyMat4, rotationAboutLine, IDENTITY, type FoldTree, type FoldNode, type Mat4 } from './unfold/folding';
export { layoutPages, layoutProblems, partBox, transformPoint, type LayoutProblem } from './layout/pack';
export { renderPage, renderPages, type PageDrawing, type RenderOptions, type FilledShape, type TextRun } from './export/render';
export { renderCover, renderBuildOrderPages, type CoverContent } from './export/cover';
export { projectModel, projectSolid, type PreviewPolygon } from './export/preview';
export { assessBuild, type BuildAssessment, type Difficulty } from './unfold/assessment';
export { textWidthMm, wrapText, toWinAnsi } from './export/helvetica';
export { partHue, partRgb } from './export/colors';
export { exportPageSvg, type SvgPurpose } from './export/svg';
export { exportPageDxf } from './export/dxf';
export { readPdf, PdfReadError, MAX_PDF_BYTES, type PdfDocument, type PdfPage, type PdfStroke, type ReadOptions } from './pdf/read';
export { traceLineArt, type PixelImage, type TraceOptions, type TraceResult, type TracedLine } from './pdf/trace';
export { lineStyles, defaultRoles, patternDrawing, styleIdOf, DEFAULT_PATTERN_OPTIONS, type LineRole, type LineStyle, type PatternOptions } from './pdf/pattern';
export { exportPdf } from './export/pdf';
export { strokeText } from './export/strokeFont';
export type { BuildStep } from './types';
export { createPapercraft, DEFAULT_PAGE_SETTINGS, type PapercraftInput, type PapercraftResult } from './pipeline';
