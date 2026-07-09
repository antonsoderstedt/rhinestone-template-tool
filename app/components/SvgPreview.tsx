'use client';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SvgPreviewProps {
  svg: string;
  title?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Renders an inline SVG preview in a scrollable bordered container.
 *
 * SECURITY NOTE: This component uses dangerouslySetInnerHTML. It must only
 * ever receive SVG strings produced by our deterministic engine functions
 * (e.g. createBasicSvgExport). Raw user-uploaded SVG must NEVER be passed
 * here without proper sanitization first — doing so would be an XSS risk.
 */
export default function SvgPreview({ svg, title = 'Preview' }: SvgPreviewProps) {
  if (!svg) {
    return (
      <div className="flex h-24 items-center justify-center rounded border border-zinc-200 bg-zinc-50 text-sm text-zinc-400">
        No SVG to preview.
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded border border-zinc-200 bg-zinc-50 p-3">
      <p className="mb-2 text-xs text-zinc-400">
        {title} — dimensions are in mm (not to screen scale)
      </p>
      {/*
        SVG content below is produced entirely by our deterministic engine
        (createBasicSvgExport). No user-uploaded SVG is rendered here.
        See component-level security note above.
      */}
      <div
        className="[&_svg]:h-auto [&_svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
