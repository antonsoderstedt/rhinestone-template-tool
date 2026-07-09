# Export Requirements — Rhinestone Template Tool

## Goal

The final SVG export must be a file that a Cricut Maker can import into Cricut Design Space, place on a 12"×12" mat, and cut with no manual adjustments to size or position.

---

## Hard Requirements

### 1. Physical Size Must Be Preserved

The exported SVG must encode its physical dimensions so that Cricut Design Space reads the correct size automatically.

**Required attributes on the root `<svg>` element:**

```xml
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="100mm"
  height="50mm"
  viewBox="0 0 100 50"
>
```

The `width` and `height` attributes use `mm` units. The `viewBox` coordinates are in the same mm space. This combination tells Cricut Design Space the exact real-world dimensions.

**If `width`/`height` are in pixels or omitted, Cricut will guess the size and the design will cut at the wrong scale. This is unacceptable.**

### 2. Every Hole Must Be a Vector Circle

Each rhinestone hole must be rendered as:

```xml
<circle cx="12.4" cy="8.1" r="1.3" />
```

- `cx`, `cy` are the stone center in mm.
- `r` is the hole radius in mm.
- Coordinates are rounded to 4 decimal places.

**Do not use:**
- `<rect>` (wrong shape)
- `<path>` approximations of circles (unnecessary complexity)
- Canvas-rendered or rasterized elements (destroys precision)
- `<image>` embeds (not cuttable)

### 3. No Rasterization in the Export Pipeline

The SVG export path must never pass through:
- An HTML `<canvas>` element
- `toDataURL()` or `toBlob()`
- Any image encoding library

The SVG must be constructed as a **string** from the engine output and written directly to a file/blob.

### 4. Cricut-Safe SVG Structure

Cricut Design Space has known limitations with SVG structure:

| Rule | Reason |
|------|--------|
| No nested `<svg>` elements | Design Space may misinterpret nested SVGs |
| No `<use>` elements | Design Space may not dereference `<use>` correctly |
| No CSS `transform` on the root element | Causes scale confusion |
| No `clip-path` on cut shapes | Cricut ignores clips |
| Stroke color must be a solid color | Not gradient |
| No `opacity` < 1 on cut shapes | Cricut may ignore semi-transparent paths |

### 5. File Format

- Extension: `.svg`
- Encoding: UTF-8
- No BOM
- No XML processing instructions other than the SVG doctype

---

## Recommended SVG Template

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="{WIDTH}mm"
  height="{HEIGHT}mm"
  viewBox="0 0 {WIDTH} {HEIGHT}"
>
  <!-- Stone holes -->
  <circle cx="..." cy="..." r="..." fill="none" stroke="#000000" stroke-width="0.1" />
  <!-- ... -->
</svg>
```

The `fill="none"` and a thin stroke are used to make the design visible when previewing. Cricut uses the path outline (stroke center line) as the cut line regardless of fill.

---

## Validation Checklist (Before Release)

- [ ] Import into Cricut Design Space — size reads correctly
- [ ] Cut on Magic Flock — holes are correct diameter
- [ ] No stone overlaps visible after placing stones
- [ ] File opens without warnings in Inkscape and Figma
- [ ] SVG validates against W3C SVG 1.1 spec
