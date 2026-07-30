'use client';

import { useState, useRef } from 'react';
import {
  parseRhinestoneProject,
} from '@/src/lib/rhinestone-engine/index';
import type {
  GeneratorProjectState,
  OutlineTextProjectState,
  DotMatrixTextProjectState,
  ManualGridProjectState,
  PolylineLogoProjectState,
  SvgUploadProjectState,
  ManualEditorProjectState,
} from '@/src/lib/rhinestone-engine/index';
import OutlineTextGenerator from './OutlineTextGenerator';
import TextMatrixGenerator from './TextMatrixGenerator';
import SvgUploadGenerator from './SvgUploadGenerator';
import ManualStoneEditor from './ManualStoneEditor';
import PolylineLogoGenerator from './PolylineLogoGenerator';
import ManualGridGenerator from './ManualGridGenerator';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Per-generator load keys — incrementing forces remount with new defaultState.
 */
type LoadKeys = {
  'outline-text': number;
  'dot-matrix-text': number;
  'manual-grid': number;
  'polyline-logo': number;
  'svg-upload': number;
  'manual-editor': number;
};

const DEFAULT_LOAD_KEYS: LoadKeys = {
  'outline-text': 0,
  'dot-matrix-text': 0,
  'manual-grid': 0,
  'polyline-logo': 0,
  'svg-upload': 0,
  'manual-editor': 0,
};

// ─── Section IDs for scroll-to ────────────────────────────────────────────────

const SECTION_ID: Record<string, string> = {
  'outline-text': 'section-outline-text',
  'dot-matrix-text': 'section-dot-matrix-text',
  'manual-grid': 'section-manual-grid',
  'polyline-logo': 'section-polyline-logo',
  'svg-upload': 'section-svg-upload',
  'manual-editor': 'section-manual-editor',
};

const GENERATOR_LABEL: Record<string, string> = {
  'outline-text': 'Outline Text Generator',
  'dot-matrix-text': 'Dot Matrix Text',
  'manual-grid': 'Manual Grid Generator',
  'polyline-logo': 'Polyline Logo Generator',
  'svg-upload': 'SVG Upload',
  'manual-editor': 'Manual Stone Editor',
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Client-side shell that wraps all project-aware generators and manages
 * the "Open project" / per-generator state restoration workflow.
 *
 * Renders as a single <article> — section order matches page.tsx.
 */
export default function ProjectShell() {
  const [loadedStates, setLoadedStates] = useState<Partial<Record<string, GeneratorProjectState>>>({});
  const [loadKeys, setLoadKeys] = useState<LoadKeys>({ ...DEFAULT_LOAD_KEYS });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedProjectName, setLoadedProjectName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleOpenProjectClick() {
    setLoadError(null);
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be re-loaded
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (ev) => {
      const json = typeof ev.target?.result === 'string' ? ev.target.result : '';
      try {
        const project = parseRhinestoneProject(json);
        const gid = project.generatorState.generatorId;

        setLoadedStates((prev) => ({ ...prev, [gid]: project.generatorState }));
        setLoadKeys((prev) => ({ ...prev, [gid]: prev[gid as keyof LoadKeys] + 1 }));
        setLoadedProjectName(project.projectName);
        setLoadError(null);

        // Scroll to the matching generator section
        setTimeout(() => {
          const id = SECTION_ID[gid];
          if (id) {
            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : String(err));
        setLoadedProjectName(null);
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-14">

      {/* ── Open Project ──────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-zinc-200 bg-white p-7 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900 mb-1">Open Project</h2>
        <p className="text-sm text-zinc-500 mb-4">
          Load a previously saved <code className="font-mono text-xs">.json</code> project file to restore all generator settings.
          The matching generator will scroll into view automatically.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          className="sr-only"
          aria-label="Open project file"
        />

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenProjectClick}
            className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            Open project (.json)
          </button>

          {loadedProjectName && !loadError && (
            <span className="text-sm text-green-700 font-medium">
              ✓ Loaded: <span className="font-normal">{loadedProjectName}</span>
            </span>
          )}
        </div>

        {loadError && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <strong>Could not load project:</strong> {loadError}
          </div>
        )}
      </section>

      {/* ── Outline Text Generator ───────────────────────────────────────── */}
      <section
        id={SECTION_ID['outline-text']}
        className="rounded-xl border border-zinc-200 bg-white p-7 shadow-sm scroll-mt-6"
      >
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-zinc-900">
            {GENERATOR_LABEL['outline-text']}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            The first real text-outline foundation — rhinestones placed along
            vector stroke outlines. Built-in font only (no TTF/OTF upload yet).
            Dot Matrix remains available below as a deterministic grid-based fallback.
          </p>
        </div>
        <OutlineTextGenerator
          key={loadKeys['outline-text']}
          defaultState={loadedStates['outline-text'] as OutlineTextProjectState | undefined}
        />
      </section>

      {/* ── Dot Matrix Text ──────────────────────────────────────────────── */}
      <section
        id={SECTION_ID['dot-matrix-text']}
        className="rounded-xl border border-zinc-200 bg-white p-7 shadow-sm scroll-mt-6"
      >
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-zinc-900">
            {GENERATOR_LABEL['dot-matrix-text']}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Convert text into a rhinestone template using the built-in 5×7 dot-matrix alphabet.
            Deterministic grid fallback — no font outlines, just dots in a matrix.
          </p>
        </div>
        <TextMatrixGenerator
          key={loadKeys['dot-matrix-text']}
          defaultState={loadedStates['dot-matrix-text'] as DotMatrixTextProjectState | undefined}
        />
      </section>

      {/* ── SVG Upload ───────────────────────────────────────────────────── */}
      <section
        id={SECTION_ID['svg-upload']}
        className="rounded-xl border border-zinc-200 bg-white p-7 shadow-sm scroll-mt-6"
      >
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-zinc-900">
            {GENERATOR_LABEL['svg-upload']}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Upload an SVG file. Supported: line, polyline, polygon, rect, circle, ellipse, and basic paths.
            Curves and transforms are applied. Arc commands (A) must be expanded before upload.
          </p>
        </div>
        <SvgUploadGenerator
          key={loadKeys['svg-upload']}
          defaultState={loadedStates['svg-upload'] as SvgUploadProjectState | undefined}
        />
      </section>

      {/* ── Manual Stone Editor ──────────────────────────────────────────── */}
      <section
        id={SECTION_ID['manual-editor']}
        className="rounded-xl border border-zinc-200 bg-white p-7 shadow-sm scroll-mt-6"
      >
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-zinc-900">
            {GENERATOR_LABEL['manual-editor']}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Add and remove individual stones from a template. Undo/redo supported.
            Drag, multi-select, and advanced editing will come later.
          </p>
        </div>
        <ManualStoneEditor
          key={loadKeys['manual-editor']}
          defaultState={loadedStates['manual-editor'] as ManualEditorProjectState | undefined}
        />
      </section>

      {/* ── Polyline Logo Generator ──────────────────────────────────────── */}
      <section
        id={SECTION_ID['polyline-logo']}
        className="rounded-xl border border-zinc-200 bg-white p-7 shadow-sm scroll-mt-6"
      >
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-zinc-900">
            {GENERATOR_LABEL['polyline-logo']}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Place stones along a polyline outline. Choose from built-in demo shapes.
            SVG upload with path extraction is built on this same engine.
          </p>
        </div>
        <PolylineLogoGenerator
          key={loadKeys['polyline-logo']}
          defaultState={loadedStates['polyline-logo'] as PolylineLogoProjectState | undefined}
        />
      </section>

      {/* ── Manual Grid Generator ────────────────────────────────────────── */}
      <section
        id={SECTION_ID['manual-grid']}
        className="rounded-xl border border-zinc-200 bg-white p-7 shadow-sm scroll-mt-6"
      >
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-zinc-900">
            {GENERATOR_LABEL['manual-grid']}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Generate a rectangular grid of rhinestone holes. Good for testing calibration
            values and spacing presets.
          </p>
        </div>
        <ManualGridGenerator
          key={loadKeys['manual-grid']}
          defaultState={loadedStates['manual-grid'] as ManualGridProjectState | undefined}
        />
      </section>

    </div>
  );
}
