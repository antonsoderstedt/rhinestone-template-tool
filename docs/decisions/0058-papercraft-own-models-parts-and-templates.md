# ADR 0058: Own models in Papercraft Studio: parametric templates and models built from parts

**Status:** accepted · **Date:** 2026-11-26

## Why

The owner wants to make their own templates in Papercraft Studio, in four ways: a 3D model built from simple shapes, a pattern
drawn flat in 2D, the current model saved as an own template, and templates whose sizes follow a few numbers. This ADR is the
first part: **parts** and **parametric templates**. Saving as an own template (to the catalog, ADR 0057) and the flat 2D
editor follow separately.

## Decisions

- **Engine** (`src/lib/papercraft-engine/mesh/builder.ts`, pure, millimetres, z-up, deterministic):
  - A `BuildPart` is a `box`, `cylinder`, `cone`, `pyramid` or `frustum` (tapering block) with width, depth, height, sides, top
    share (frustum), which end is open, a place (the centre of the base) and a turn (degrees about x, then y, then z).
    `partMesh` gives faces counter-clockwise from outside (a closed part is a solid; tests check volume and closedness);
    `clampPart` brings every number into range (and replaces a non-number), so a mesh can always be built.
  - `buildParts` puts the parts into one mesh. Parts stay separate shells (no boolean union): a papercraft model of boxes glued
    together is what it is, and an **open end** (`open: top | bottom | both`) leaves out the lid where two parts meet or where a
    tube is left open. At most 40 parts.
  - A `ParametricTemplate` is a list of parameters (label, tip, range, default) and a function from the values to parts: Box with a
    lid, Pencil cup, House, Tower, Tiered cake. Values are clamped to range and counts rounded (`templateValues`).
  - A `ModelRecipe` is either `{kind:'parametric', templateId, values}` or `{kind:'parts', parts}`; `meshOfRecipe` builds the mesh
    (null for an unknown template or no parts).
- **State** (`papercraftState.ts`): a file source may carry a `recipe`. `USE_RECIPE` starts a model, `SET_RECIPE` changes it (name and
  paper stay; layout pins and hand-edited edges are cleared because their ids belong to the old mesh). The size is set to the longest
  side of the mesh, so the numbers in the recipe are the finished sizes; if the person then changes Size, the model scales and the numbers
  no longer match until one is changed (the panel says so).
- **Saving** (`papercraftSnapshot.ts`): the recipe is saved next to the mesh (optional, so older designs open as before). On reading, a
  damaged recipe is left out (the saved mesh still opens), numbers out of range are brought back and an unknown template is dropped.
- **UI** (`BuilderSection.tsx`, section “Build your own model” in the Model panel): template buttons and “From parts”; sliders/fields for the
  template's values (lengths in the person's unit), “Change it part by part” turns a template into parts, and a part editor
  (kind, sizes, sides, top width, ends, position, turn, copy, remove, add).

## Consequences

- Overlapping parts are not merged: two parts that cut into each other give two shells that cross. Place them to touch and leave the
  touching ends open.
- A model made of parts has no “detail” control (it is as simple as it is made).
- A template converted to parts cannot go back to its numbers.
- **Save as a template** (added; `papercraftCatalog.ts`, `CatalogSections.tsx`): the Model panel's “Save as a template” puts the open design in the
  catalog (ADR 0057) as a new Papercraft template: details (name, category, published, “Made in”), the design as `<id>.json` (the same text
  as a saved design, so it carries size, paper, tab settings and the recipe) and a small SVG picture of the model (plain polygons). The id is made from
  the name and never replaces a template (`name`, `name-2`, …). “From the catalog” lists published models (OBJ/STL/GLB, imported as a file) and
  saved templates (JSON, opened as a whole design through `LOAD_STATE`; a JSON file that is not one of ours is refused). Opening one starts a new unsaved design.
  The section only shows where there is a catalog.
- Not in this part: a flat 2D pattern editor, a 3D drag editor for the parts.
