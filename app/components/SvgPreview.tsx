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
      <div className="flex h-40 items-center justify-center rounded border border-zinc-200 bg-zinc-50 text-sm text-zinc-400">
        No SVG to preview.
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-lg border border-zinc-200 bg-white shadow-inner">
      <div className="border-b border-zinc-100 px-4 py-2">
        <p className="text-xs font-medium text-zinc-500">
          {title} — <span className="font-normal">dimensions in mm (preview not to scale)</span>
        </p>
      </div>
      <div className="flex min-h-56 items-center justify-center bg-[#f8f8f8] p-4">
        {/*
          SVG content is produced entirely by our deterministic engine
          (createBasicSvgExport). No user-uploaded SVG is rendered here.
          See component-level security note above.
        */}
        <div
          className="[&_svg]:h-auto [&_svg]:max-h-96 [&_svg]:max-w-full [&_svg]:drop-shadow-sm"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}
