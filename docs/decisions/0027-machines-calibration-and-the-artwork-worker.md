# ADR 0027: Machines, calibration status and the artwork worker

**Status:** accepted · **Date:** 2026-11-22 · **Plan items:** E1, E3, C4

## Machines and materials (E1)

There is **no machine selector**. An earlier version of the settings had one (machine, mat, blade) and it was removed on purpose:
it implied values for machines that nobody had measured. The geometry of a template does not depend on the machine. The only
numbers the app holds that do (blade, pressure, passes) are for Magic Flock on a Cricut Maker 3 and are marked as a starting
point. For any other machine or flock the honest tools are the ones that already exist: a calibration profile (named, dated,
one hole size per stone size, any number of them) and the test patch ("Cut a small test first"). Inventing settings for other
machines would be worse than saying nothing. Revisit when someone measures another machine.

## Calibration status per stone size (E3)

The export dialog now lists each stone size in the design: measured on the user's material (from the approved profile), a
verified standard value for the material (and a nudge to cut a test patch), or only a starting value (calibrate first).
`app/lib/calibrationStatus.ts`.

## Artwork in a worker (C4)

Laying out SVG artwork runs in a Web Worker (`artworkWorker.ts`, started by `artworkWorkerClient.ts`), so the page stays
responsive for large or fine artwork. If the browser has no workers, or the worker fails, the same function runs on the main
thread, so the result is always the same. The worker bundle imports only `artworkCore.ts`, which uses deep engine imports: when
it imported the engine's index (fonts, storage, export) the production build failed with a Turbopack panic. Text generation
and pictures still run on the main thread (text is asynchronous already, pictures are decoded first); they can move the same way.
