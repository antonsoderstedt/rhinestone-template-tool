// ─── Props ────────────────────────────────────────────────────────────────────

interface StatEntry {
  label: string;
  value: string | number;
}

interface TemplateStatsCardProps {
  stoneCount: number;
  stoneSize?: string;
  columns?: number;
  rows?: number;
  material?: string;
  cutter?: string;
  extraStats?: StatEntry[];
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Compact template stats display.
 * Used by ManualGridGenerator, CalibrationSheetGenerator, and any future generators.
 */
export default function TemplateStatsCard({
  stoneCount,
  stoneSize,
  columns,
  rows,
  material,
  cutter,
  extraStats,
}: TemplateStatsCardProps) {
  const stats: StatEntry[] = [];

  if (material !== undefined) stats.push({ label: 'Material', value: material });
  if (cutter !== undefined) stats.push({ label: 'Cutter', value: cutter });
  if (stoneSize !== undefined) stats.push({ label: 'Stone size', value: stoneSize });
  stats.push({ label: 'Stone count', value: stoneCount });
  if (columns !== undefined) stats.push({ label: 'Columns', value: columns });
  if (rows !== undefined) stats.push({ label: 'Rows', value: rows });

  if (extraStats) {
    for (const s of extraStats) {
      stats.push(s);
    }
  }

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
      {stats.map(({ label, value }) => (
        <div key={label}>
          <dt className="text-ink-muted">{label}</dt>
          <dd className="font-semibold text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
