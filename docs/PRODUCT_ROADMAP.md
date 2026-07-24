# Product Roadmap — Rhinestone Template Tool

> Last updated: 2026-07-12

---

## 1. Product Vision

A professional rhinestone template generator for **Cricut Maker + Magic Flock** that produces production-ready SVG templates from text, logos, uploaded SVG files, and eventually images.

Every exported hole is a real vector `<circle>` sized in mm. The tool handles the full workflow from design input through physical calibration to final Cricut-safe export.

---

## 2. Target Users

| User | Primary need |
|---|---|
| Small business owners making rhinestone apparel | Fast, reliable templates without Illustrator expertise |
| Cricut users | Downloadable SVGs that import correctly into Cricut Design Space |
| Merch designers | Text-to-rhinestone and logo-to-rhinestone pipelines |
| Brand owners | Repeatable rhinestone graphics from brand assets |
| **Smooch internal workflow** | Logo/lip-icon templates, SS6/SS10 test files, merch-ready exports |

---

## 3. Final Product Modules

### A. Text-to-Rhinestones

| Status | Feature |
|---|---|
| ✅ Done | Dot Matrix Text (5×7 bitmap font) |
| ✅ Done | Built-in Vector Outline Text (stroke font, A–Z, 0–9) |
| ✅ Done | Outline / fill / outline-fill modes |
| ✅ Done | Multiline, letter spacing, line spacing, alignment, scaling |
| 🔜 Planned | Real font outline extraction from glyph contours |
| 🔜 Planned | TTF/OTF font upload (drag-and-drop) |
| 🔜 Planned | Font picker (system fonts or uploaded) |
| 🔜 Planned | Curved / warped text (arc, wave) |
| 🔜 Planned | Centerline mode (single stroke down glyph centre) |
| 🔜 Planned | Better kerning and pair-adjustment tables |

### B. Logo/SVG-to-Rhinestones

| Status | Feature |
|---|---|
| ✅ Done | Safe SVG upload (raw SVG never rendered) |
| ✅ Done | Primitive parsing: line, polyline, polygon, rect, circle, ellipse |
| ✅ Done | Path parsing: M/L/H/V/Z/C/S/Q/T commands |
| ✅ Done | Curves and transforms |
| ✅ Done | Polyline cleanup (dedup, simplify, remove tiny shapes) |
| ✅ Done | Physical size controls (targetWidthMm / targetHeightMm) |
| ✅ Done | Fill mode (grid, offset-grid inside closed shapes) |
| 🔜 Planned | Before/after cleanup preview |
| 🔜 Planned | Per-shape fill/outline mode selector |
| 🔜 Planned | Arc command (A) expansion in the parser |
| 🔜 Planned | Layer and group support |
| 🔜 Planned | Auto-fix guidance for unsupported SVG features |
| 🔜 Planned | Logo-specific density presets |

### C. Image-to-Rhinestones

| Status | Feature |
|---|---|
| ❌ Not started | PNG/JPG upload |
| ❌ Not started | Threshold / silhouette mode |
| ❌ Not started | Edge detection |
| ❌ Not started | Vectorization pipeline |
| ❌ Not started | Fill sampling from image regions |
| ❌ Not started | Background removal |
| ❌ Not started | Manual correction after vectorization |

> **Note:** Image-to-rhinestones is a distinct feature track. Do not begin until the SVG/text pipeline is physically validated.

### D. Manual Editor

| Status | Feature |
|---|---|
| ✅ Done | Add / remove individual stones |
| ✅ Done | Undo / redo history |
| ✅ Done | Stone list with click-to-select |
| ✅ Done | Add stone by typing X/Y mm coordinates |
| 🔜 Planned | Click-on-preview canvas to add stone at position |
| 🔜 Planned | Drag / move stones on canvas |
| 🔜 Planned | Multi-select (shift-click or marquee) |
| 🔜 Planned | Delete selected stones |
| 🔜 Planned | Duplicate / clone selection |
| 🔜 Planned | Snap to grid |
| 🔜 Planned | Align tools (centre, distribute) |
| 🔜 Planned | Brush mode (paint-add, paint-remove) |
| 🔜 Planned | Collision warning highlights while editing |
| 🔜 Planned | Zoom / pan canvas |
| 🔜 Planned | Keyboard shortcuts |

### E. Calibration + Material Profiles

| Status | Feature |
|---|---|
| ✅ Done | Magic Flock + Cricut Maker provisional profile |
| ✅ Done | Multi-size calibration sheet generator |
| ✅ Done | Calibration workflow UI |
| ✅ Done | Hole diameter overrides per stone size |
| 🔜 Planned | Saved calibrated profiles (browser localStorage) |
| 🔜 Planned | Per-cutter profiles (Cricut Maker, Explore, Silhouette) |
| 🔜 Planned | Per-material profiles (Magic Flock, HTV, leather) |
| 🔜 Planned | Scale compensation and kerf compensation fields |
| 🔜 Planned | Calibration history log |
| 🔜 Planned | Profile import/export as JSON |

### F. Export System

| Status | Feature |
|---|---|
| ✅ Done | Cricut-safe SVG export (real `<circle>` elements, mm units) |
| ✅ Done | Physical mm sizing |
| ✅ Done | Export readiness QA (blocks download when not ready) |
| ✅ Done | Include/exclude guide box and labels |
| 🔜 Planned | Project JSON export/import |
| 🔜 Planned | PDF preview export |
| 🔜 Planned | Export presets (filename templates, padding defaults) |
| 🔜 Planned | Multi-template cut sheet layout |
| 🔜 Planned | DXF export (optional, later) |
| 🔜 Planned | Versioned export history |

### G. Project System

| Status | Feature |
|---|---|
| ❌ Not started | Save / open projects |
| ❌ Not started | Project JSON import/export |
| ❌ Not started | Browser localStorage persistence |
| ❌ Not started | Template library |
| ❌ Not started | Duplicate project |
| ❌ Not started | Export history |
| ❌ Not started | Cloud saved projects (requires auth) |

> Start with browser localStorage or project JSON download — no auth needed.

### H. SaaS / Commercial Features

| Status | Feature |
|---|---|
| ❌ Not started | Auth / login |
| ❌ Not started | User accounts |
| ❌ Not started | Free / pro tier limits |
| ❌ Not started | Payments (Stripe or Paddle) |
| ❌ Not started | Saved templates per account |
| ❌ Not started | Template marketplace |
| ❌ Not started | Admin dashboard |
| ❌ Not started | Usage tracking |
| ❌ Not started | Onboarding flow |
| ❌ Not started | In-app help documentation |

> **Do not begin SaaS features until physical Cricut QA is complete and the core product is validated.**

### I. Smooch-Specific Workflow

| Status | Feature |
|---|---|
| ✅ Done | Cricut Test Pack (generic) |
| ✅ Done | SS10 calibration workflow |
| 🔜 Planned | Smooch logo preset |
| 🔜 Planned | Smooch lip icon template |
| 🔜 Planned | SS6 / SS10 Smooch-specific test files |
| 🔜 Planned | Merch-ready export presets (naming, padding, sizing) |
| 🔜 Planned | Brand preset (Smooch asset library) |
| 🔜 Planned | Smooch product test pack |

---

## 4. Near-Term Roadmap

### Beta Phase — Physical Validation (Do This First)

These are not code tasks. They block everything else.

1. Open app (`npm run dev`)
2. Download Cricut Test Pack → open in Cricut Design Space → verify mm dimensions
3. Cut calibration sheet on Magic Flock → measure actual hole diameters
4. Enter measurements in Calibration Workflow → apply → re-cut
5. Validate SS10 hole size for Smooch stones specifically
6. Test Smooch logo SVG upload → adjust cleanup → validate template
7. Record best diameter per stone size and update material profile

### Next Build Sprints (After Physical QA)

| Priority | Sprint |
|---|---|
| 1 | Project JSON import/export (save and reload designs) |
| 2 | Manual Editor v2 (click-to-add, drag stones) |
| 3 | Before/after SVG cleanup preview |
| 4 | Saved calibrated material profiles |
| 5 | Smooch logo/lip-icon workflow improvements |

### Later

| When | What |
|---|---|
| After Editor v2 | Real font upload (TTF/OTF) |
| After font upload | Image-to-rhinestones |
| After physical validation | SaaS accounts and payments |

---

## 5. What Not to Build Yet

Until physical Cricut QA is complete and the core workflow is validated on real material, **do not prioritize:**

- Auth and user accounts
- Payments / billing
- Database / cloud storage
- Template marketplace
- Image-to-rhinestones pipeline
- Advanced AI features
- Full SaaS infrastructure
- Complex font file parsing

These features add engineering cost and operational risk before the core product is confirmed to work reliably in the real physical cutting workflow.

---

## 6. Product Success Criteria

The final product should let any user complete this full workflow without external tools:

1. Create a rhinestone template from text **or** upload a logo SVG
2. Choose stone size (SS6 / SS8 / SS10 / SS12)
3. Set physical dimensions in mm
4. Choose outline / fill / outline-fill mode
5. Preview the rhinestone result in the browser
6. Manually add, remove, or move stones as needed
7. Validate export readiness (zero blocking issues)
8. Download a Cricut-safe SVG
9. Import into Cricut Design Space with correct mm dimensions
10. Cut on Magic Flock with correctly sized holes
11. Place rhinestones — they snap cleanly without force
12. Calibrate hole sizes from measured test cuts and save the profile
13. Reload a saved project and continue editing

---

## 7. Known Risks

| Risk | Mitigation |
|---|---|
| Cricut Design Space SVG scale import | Physical QA first; use explicit `width`/`height` in mm on root `<svg>` |
| Magic Flock hole diameter variance | Calibration sheet + workflow already implemented |
| SS stone supplier variance | Per-supplier profile support in roadmap |
| Complex SVGs may not parse | Cleanup controls + before/after preview planned |
| Fill mode too dense for real cutting | Test at `safe` and `loose` presets; document recommended preset per use case |
| Real font parsing is non-trivial | Deferred; built-in font proves pipeline |
| Image-to-rhinestones is a large separate track | Scoped out of core product until v2+ |
| SaaS infrastructure risk | Deferred until core product is physically validated |
