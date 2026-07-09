# Product Requirements Document — Rhinestone Template Tool

## Overview

Rhinestone Template Tool is a web-based design tool that generates **physically accurate, Cricut-ready SVG cut files** for rhinestone templates applied to Magic Flock material.

The user provides a design — text, an SVG/logo, or (later) a raster image — and the tool fills it with rhinestones at the correct physical density and spacing. The output is a vector SVG file that a Cricut Maker can cut directly as a rhinestone template.

---

## Problem Statement

Creating rhinestone templates manually is tedious, error-prone, and requires expensive proprietary software. Crafters who want custom rhinestone designs on garments using a Cricut need a tool that:

1. Handles the physical math of stone placement automatically.
2. Produces cut files that are dimensionally accurate in the real world.
3. Works with their existing hardware: Cricut Maker + Magic Flock.

---

## Product Vision

A fast, browser-based tool where a crafter:
1. Enters text, uploads an SVG/logo, or (later) uploads a raster image.
2. Configures stone size, material, and design dimensions.
3. Downloads a Cricut-safe SVG cut file.

**No proprietary software. No guesswork. Physically correct output every time.**

---

## MVP Scope

### Inputs (MVP)
- **Text** — single-line and multi-line text filled with rhinestones
- **SVG/Logo** — user-uploaded SVG, filled with rhinestones

### Inputs (Post-MVP)
- PNG/JPG raster images (converted to vector paths before stone placement)

### Output
- Cricut-ready SVG cut file with real vector circles representing stone holes
- Each circle corresponds exactly to one rhinestone cut hole
- File is dimensionally accurate in millimeters

### Stone Sizes (MVP)
| Size | Diameter (mm) |
|------|--------------|
| SS6  | 2.0 mm       |
| SS8  | 2.4 mm       |
| SS10 | 2.8 mm       |
| SS12 | 3.2 mm       |

### Target Material
- **Magic Flock** — requires specific hole sizing and spacing due to material stretch

### Target Cutter
- **Cricut Maker** — all SVG output must be Cricut-compatible

---

## Non-Goals (MVP)
- Multi-color rhinestone designs
- Rhinestone size mixing within a single design
- Raster image tracing (post-MVP)
- Selling/sharing designs (no user accounts in MVP)
- Mobile-first layout (desktop-first MVP)

---

## Success Criteria
- Generated SVG can be imported into Cricut Design Space without errors.
- Holes cut in Magic Flock accept the correct stone size without stretching.
- A 100mm-wide design measures 100mm when printed/cut.
- No stone overlaps in the output.
- Text designs are legible at 50mm height.
