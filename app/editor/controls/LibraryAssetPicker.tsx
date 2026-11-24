'use client';

import { useEffect, useState } from 'react';
import { Library } from 'lucide-react';
import { readWorkspaceVault, type WorkspaceAsset } from '../../lib/workspaceVault';
import { useT } from '../../lib/i18n';
import { editorFieldLabelClassName } from './controlStyles';

/** Pick a file that is already in the Library, instead of choosing one from the computer again. */
export default function LibraryAssetPicker({ onPick, currentName }: { onPick: (asset: WorkspaceAsset) => void; currentName?: string | null }) {
  const t = useT();
  const [assets, setAssets] = useState<WorkspaceAsset[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const load = () => {
      const vault = readWorkspaceVault();
      const usable = vault.assets.filter((asset) => !asset.archived);
      queueMicrotask(() => setAssets(usable));
    };
    load();
    window.addEventListener('focus', load);
    window.addEventListener('storage', load);
    return () => {
      window.removeEventListener('focus', load);
      window.removeEventListener('storage', load);
    };
  }, []);

  const count = assets?.length ?? 0;
  return (
    <div className="space-y-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex w-fit items-center gap-2 rounded-md border border-[var(--studio-border)] px-3 py-2 text-xs font-medium text-[var(--studio-ink-secondary)] transition hover:border-violet-400/50 hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-accent-400"
      >
        <Library className="h-3.5 w-3.5" aria-hidden="true" />
        {t('Choose from the library')} ({count})
      </button>
      {open && count === 0 && (
        <p className="text-xs text-[var(--studio-ink-muted)]">{t('The library is empty. Upload files in the Library and they will be here.')}</p>
      )}
      {open && count > 0 && (
        <div className="space-y-1.5" role="group" aria-label={t('Files in the library')}>
          <span className={editorFieldLabelClassName}>{t('Files in the library')}</span>
          <ul className="grid max-h-56 grid-cols-3 gap-1.5 overflow-y-auto pr-1">
            {assets!.map((asset) => (
              <li key={asset.assetId}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(asset);
                    setOpen(false);
                  }}
                  aria-label={asset.name}
                  title={asset.name}
                  aria-pressed={currentName === asset.fileName}
                  className="flex w-full flex-col items-center gap-1 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-well)] p-1.5 text-xs text-[var(--studio-ink-secondary)] transition hover:border-violet-400/50 focus:outline-none focus:ring-2 focus:ring-accent-400"
                >
                  {/* A thumbnail the Library made itself (a data: address), never a web address. */}
                  {/* eslint-disable-next-line @next/next/no-img-element -- data: URI from the user's own library */}
                  <img src={asset.previewDataUrl} alt="" className="h-14 w-full rounded object-contain bg-white/5" />
                  <span className="w-full truncate text-center">{asset.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
