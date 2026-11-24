# ADR 0031: Stone diameter is not hole diameter

**Status:** accepted · **Date:** 2026-11-24

## Why

An outside review of the calibration page found that SS16 and SS20 were shown with a *stone* diameter of 4.394 mm and 5.283 mm.
Those are The Rhinestone World's Magic Flock **hole** sizes (0.173 in and 0.208 in), not the stones, which are about 3.9 mm and
4.7 mm. The two measures must never be mixed: the hole is cut about half a millimetre larger than the stone.

## Decision

- `stoneDiameterMm` is the stone: SS6 2.0, SS8 2.4, SS10 2.8, SS12 3.1, SS16 3.9, SS20 4.7 (mm). Hole diameters live only in the
  material profile (Magic Flock: 2.54, 3.00, 3.43, 3.80, 4.39, 5.28). A test keeps every hole larger than its stone by under 0.9 mm.
- SS16 and SS20 carry a note that TRW publishes a second series on many design pages (0.176 in = 4.47 mm and 0.212 in = 5.38 mm);
  the calibration series for SS20 already reaches 5.38.
- Template import guesses a stone size by matching a circle against both the stone and the hole size of each size (nearest wins,
  0.3 mm). A 3.3 mm circle, the hole of common SS10 templates, is now SS10 (it was SS12). The label is only a fallback; the circle
  keeps its diameter.

## Open

- SS8's 3.00 mm hole is recorded as a TRW value in ADR 0004, but it was not found again in TRW's public SS6/SS10/SS16/SS20 list.
  It stays `verified` until someone with the source says otherwise; it carries a note to calibrate.
- SS12's 3.80 mm stays `provisional`.
