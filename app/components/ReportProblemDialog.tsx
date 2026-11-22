'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import Modal from '../editor/ui/Modal';
import { buildProblemReport, problemReportFilename } from '../lib/problemReport';

const TITLE_ID = 'report-problem-title';

/** Writes a problem report to a file on the user's computer. Nothing is sent; they attach the file themselves. */
export default function ReportProblemDialog({
  open,
  onClose,
  getDesignJson,
}: {
  open: boolean;
  onClose: () => void;
  /** The current design as project JSON, or null when there is none. Called only if the user ticks the box. */
  getDesignJson?: () => string | null;
}) {
  const [description, setDescription] = useState('');
  const [attach, setAttach] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const canAttach = Boolean(getDesignJson);

  const save = () => {
    const createdAt = new Date().toISOString();
    const result = buildProblemReport({
      description,
      designJson: attach && getDesignJson ? getDesignJson() : null,
      page: window.location.pathname,
      userAgent: navigator.userAgent,
      language: navigator.language,
      screen: { width: window.innerWidth, height: window.innerHeight },
      createdAt,
    });
    const url = URL.createObjectURL(new Blob([result.text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = problemReportFilename(createdAt);
    a.click();
    URL.revokeObjectURL(url);
    setNotice(
      result.designSkipped
        ? 'The report was saved without the design (it was too big to attach). Send the file to whoever helps you.'
        : 'The report was saved as a file. Send it to whoever helps you; nothing has been sent from here.',
    );
  };

  return (
    <Modal open={open} onClose={onClose} titleId={TITLE_ID} overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div role="document" className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-zinc-100 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h2 id={TITLE_ID} className="text-base font-semibold">Report a problem</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-400">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          This makes a file on your computer that you can send to whoever is helping you. The app sends nothing by itself.
        </p>
        <label className="mt-4 flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400">
          What went wrong?
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            placeholder="For example: the stones are missing after I changed the size"
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm normal-case tracking-normal text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </label>
        {canAttach && (
          <label className="mt-3 flex items-start gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={attach} onChange={(event) => setAttach(event.target.checked)} className="mt-1" />
            <span>Include my current design, so the problem can be seen. It stays in the file.</span>
          </label>
        )}
        <p className="mt-3 text-xs text-zinc-500">The file also says which page you were on and which browser and screen size you use. Nothing else.</p>
        {notice && <p role="status" className="mt-3 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">{notice}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-400">Close</button>
          <button type="button" onClick={save} className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-400">Save the report</button>
        </div>
      </div>
    </Modal>
  );
}
