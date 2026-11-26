'use client';

import { ShieldCheck } from 'lucide-react';
import { WorkspaceHero, WorkspacePage } from '../components/workspace/WorkspaceChrome';
import { useT } from '../lib/i18n';
import CatalogAdmin from './CatalogAdmin';

export default function AdminPage() {
  const t = useT();
  return (
    <WorkspacePage tone="neutral">
      <div className="mx-auto max-w-7xl space-y-6">
        <WorkspaceHero
          eyebrow={<><ShieldCheck className="h-4 w-4" aria-hidden="true" /> {t('Admin')}</>}
          title={t('Admin panel')}
          description={t('Upload and manage the templates the studios can use. Only you can open this page: it is behind your Cloudflare Access login.')}
          tone="neutral"
        />
        <CatalogAdmin />
      </div>
    </WorkspacePage>
  );
}
