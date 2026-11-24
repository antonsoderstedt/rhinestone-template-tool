/**
 * "Report a problem": a file the user can send, made only when they ask and only on their own computer. Nothing is sent
 * anywhere by the app. The design is attached only if the user ticks the box.
 */

export interface ProblemReportInput {
  description: string;
  /** The project file as JSON text, or null when the user did not attach their design. */
  designJson: string | null;
  page: string;
  userAgent: string;
  language: string;
  screen: { width: number; height: number };
  /** ISO time. Passed in so the report is the same for the same input. */
  createdAt: string;
}

export const PROBLEM_REPORT_KIND = 'rhinestone-studio-problem-report';
/** A design bigger than this is not attached (the file would be too big to send by e-mail). */
export const MAX_ATTACHED_DESIGN_BYTES = 8 * 1024 * 1024;

export function buildProblemReport(input: ProblemReportInput): { text: string; designAttached: boolean; designSkipped: boolean } {
  let design: unknown = null;
  let designSkipped = false;
  if (input.designJson !== null) {
    if (input.designJson.length > MAX_ATTACHED_DESIGN_BYTES) designSkipped = true;
    else {
      try {
        design = JSON.parse(input.designJson);
      } catch {
        designSkipped = true;
      }
    }
  }
  const report = {
    kind: PROBLEM_REPORT_KIND,
    version: 1,
    createdAt: input.createdAt,
    description: input.description.trim().slice(0, 5000),
    environment: { page: input.page, userAgent: input.userAgent, language: input.language, screen: input.screen },
    design,
  };
  return { text: JSON.stringify(report, null, 2), designAttached: design !== null, designSkipped };
}

export function problemReportFilename(createdAtIso: string): string {
  const day = /^\d{4}-\d{2}-\d{2}/.exec(createdAtIso)?.[0] ?? 'report';
  return `rhinestone-studio-problem-${day}.json`;
}
