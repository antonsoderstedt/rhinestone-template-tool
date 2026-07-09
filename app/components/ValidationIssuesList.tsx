// ─── Props ────────────────────────────────────────────────────────────────────

interface ValidationIssue {
  severity: string;
  code: string;
  message: string;
  stoneIds?: string[];
}

interface ValidationIssuesListProps {
  valid: boolean;
  issues: ValidationIssue[];
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Displays template validation status and any issues.
 * Shows a success message when valid with no issues.
 */
export default function ValidationIssuesList({ valid, issues }: ValidationIssuesListProps) {
  return (
    <div
      className={`rounded border p-3 text-sm ${
        valid
          ? 'border-green-300 bg-green-50 text-green-800'
          : 'border-red-300 bg-red-50 text-red-700'
      }`}
    >
      <strong>{valid ? '✓ Template valid' : '✗ Template invalid'}</strong>
      {valid && issues.length === 0 && (
        <p className="mt-0.5 text-xs opacity-75">
          No issues detected. Safe to export.
        </p>
      )}
      {issues.length > 0 && (
        <ul className="mt-1 list-disc pl-4">
          {issues.map((issue, i) => (
            <li key={i}>
              <span className="font-mono text-xs">[{issue.code}]</span>{' '}
              {issue.message}
              {issue.stoneIds && issue.stoneIds.length > 0 && (
                <span className="ml-1 text-xs opacity-75">
                  ({issue.stoneIds.join(', ')})
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
