'use client';

import { Link2 } from 'lucide-react';
import { buildShareLink } from '../lib/shareLink';

/** "Copy a link to this design": the design is inside the link, nothing is uploaded. */
export default function SharePanel({
  getProjectJson,
  onDone,
}: {
  getProjectJson: () => string | null;
  onDone: (message: string, tone: 'success' | 'warning' | 'error') => void;
}) {
  const copy = async () => {
    const json = getProjectJson();
    if (!json) {
      onDone('There is no design to share yet.', 'warning');
      return;
    }
    const result = await buildShareLink(json, window.location.origin);
    if (!result.ok) {
      onDone('This design is too big for a link. Send the project file instead (Save project file).', 'warning');
      return;
    }
    try {
      await navigator.clipboard.writeText(result.url);
      onDone('Link copied. Whoever opens it gets their own copy of the design.', 'success');
    } catch {
      onDone('Could not copy the link here. Your browser did not allow it.', 'error');
    }
  };
  return (
    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-300">
      <p className="flex items-center gap-1.5 font-semibold text-zinc-100">
        <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
        Share this design
      </p>
      <p className="mt-1 leading-5 text-zinc-400">
        A link with the whole design inside it. Nothing is uploaded; the design never leaves your computer except where you paste the link.
      </p>
      <button
        type="button"
        onClick={() => void copy()}
        className="mt-2 inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 font-medium text-zinc-100 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
      >
        Copy link
      </button>
    </div>
  );
}
