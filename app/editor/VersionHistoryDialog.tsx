'use client';

import { History, X } from 'lucide-react';
import Modal from './ui/Modal';
import { formatRelativeTime } from '../lib/relativeTime';
import type { DesignVersion } from '../lib/versionHistory';

import { useT } from '../lib/i18n';
const TITLE_ID = 'version-history-title';

/** The last few saved versions of the open design, with a button to go back to one. */
export default function VersionHistoryDialog({
  open,
  onClose,
  designName,
  versions,
  now,
  onRestore,
}: {
  open: boolean;
  onClose: () => void;
  designName: string;
  versions: readonly DesignVersion[];
  now: Date;
  onRestore: (version: DesignVersion) => void;
}) {
  const t = useT();
  return (
    <Modal open={open} onClose={onClose} titleId={TITLE_ID} overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div role="document" className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-zinc-100 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h2 id={TITLE_ID} className="flex items-center gap-2 text-base font-semibold">
            <History className="h-4 w-4" aria-hidden="true" />
            Earlier versions of {designName}
          </h2>
          <button type="button" onClick={onClose} aria-label={t('Close')} className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-400">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {versions.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">
            {t('There are none yet. A version is kept each time you save over an earlier one. Designs with very many hand-placed stones are too big to keep versions of.')}
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-zinc-400">{t('Going back to a version keeps what you have now as a version too, so you can come back.')}</p>
            <ul className="mt-3 space-y-2">
              {versions.map((version) => (
                <li key={version.savedAt} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                  <span className="text-sm">
                    {formatRelativeTime(version.savedAt, now)}
                    <span className="ml-2 text-xs text-zinc-400">{version.stoneCount} stones</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onRestore(version)}
                    className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  >
                    {t('Go back to this')}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
}
