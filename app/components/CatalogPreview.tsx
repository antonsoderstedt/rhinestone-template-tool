'use client';

import { useEffect, useState } from 'react';
import { fetchCatalogFile, type CatalogTemplate } from '../lib/catalog/catalogClient';
import { formatOfFileName, mimeOfFormat } from '../lib/catalog/catalogFormat';

/** A catalog template's small picture, fetched when it shows. Empty while it loads or when the template has none. */
export default function CatalogPreview({ template, className = '' }: { template: CatalogTemplate; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const has = template.preview !== null;
  const stamp = template.updatedAt;
  useEffect(() => {
    if (!has) return undefined;
    let cancelled = false;
    let made: string | null = null;
    void fetchCatalogFile(template, 'preview').then((result) => {
      if (cancelled || !result.ok) return;
      const type = mimeOfFormat(formatOfFileName(result.value.name));
      made = URL.createObjectURL(new Blob([result.value.bytes as BlobPart], { type }));
      setUrl(made);
    });
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
    // The picture is fetched again when the template changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id, has, stamp]);
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden ${className}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- a picture from the catalog, shown from a blob: address
        <img src={url} alt="" className="h-full w-full object-contain" />
      ) : null}
    </div>
  );
}
