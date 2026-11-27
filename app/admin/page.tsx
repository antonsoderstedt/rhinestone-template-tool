'use client';

import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { WorkspaceHero, WorkspacePage } from '../components/workspace/WorkspaceChrome';
import { useT } from '../lib/i18n';
import CatalogAdmin from './CatalogAdmin';
import StatsAdmin from './StatsAdmin';
import TrackingAdmin from './TrackingAdmin';

type Tab = 'templates' | 'statistics' | 'tracking';

export default function AdminPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>('templates');
  const tabs: { id: Tab; name: string }[] = [
    { id: 'templates', name: t('Templates') },
    { id: 'statistics', name: t('Statistics') },
    { id: 'tracking', name: t('Tracking') },
  ];
  return (
    <WorkspacePage tone="neutral">
      <div className="mx-auto max-w-7xl space-y-6">
        <WorkspaceHero
          eyebrow={<><ShieldCheck className="h-4 w-4" aria-hidden="true" /> {t('Admin')}</>}
          title={t('Admin panel')}
          description={t('Upload and manage the templates the studios can use, see how the site is used, and choose what is tracked. Only you can open this page: it is behind your Cloudflare Access login.')}
          tone="neutral"
        />
        <div role="tablist" aria-label={t('Admin sections')} className="flex gap-2 border-b border-border/70">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`admin-tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls={`admin-panel-${item.id}`}
              onClick={() => setTab(item.id)}
              className={`-mb-px rounded-t-xl border-b-2 px-5 py-3 text-sm font-semibold transition ${tab === item.id ? 'border-accent-500 text-ink' : 'border-transparent text-ink-secondary hover:text-ink'}`}
            >
              {item.name}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`admin-panel-${tab}`} aria-labelledby={`admin-tab-${tab}`}>
          {tab === 'templates' ? <CatalogAdmin /> : tab === 'statistics' ? <StatsAdmin /> : <TrackingAdmin />}
        </div>
      </div>
    </WorkspacePage>
  );
}
