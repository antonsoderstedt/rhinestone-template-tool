'use client';

import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { WorkspaceHero, WorkspacePage } from '../components/workspace/WorkspaceChrome';
import { useT } from '../lib/i18n';
import CatalogAdmin from './CatalogAdmin';
import LibraryAdmin from './LibraryAdmin';
import MetaAdmin from './MetaAdmin';
import StatsAdmin from './StatsAdmin';
import TrackingAdmin from './TrackingAdmin';

type Tab = 'templates' | 'statistics' | 'tracking' | 'site' | 'libraries';

export default function AdminPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>('templates');
  const tabs: { id: Tab; name: string }[] = [
    { id: 'templates', name: t('Templates') },
    { id: 'libraries', name: t('Libraries') },
    { id: 'statistics', name: t('Statistics') },
    { id: 'tracking', name: t('Tracking') },
    { id: 'site', name: t('Site text') },
  ];
  return (
    <WorkspacePage tone="neutral">
      <div className="mx-auto max-w-7xl space-y-6">
        <WorkspaceHero
          eyebrow={<><ShieldCheck className="h-4 w-4" aria-hidden="true" /> {t('Admin')}</>}
          title={t('Admin panel')}
          description={t('Upload and manage the templates the studios can use, see how the site is used, choose what is tracked, and set the title and description. Only you can open this page: it is behind your Cloudflare Access login.')}
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
          {tab === 'templates' ? <CatalogAdmin /> : tab === 'libraries' ? <LibraryAdmin /> : tab === 'statistics' ? <StatsAdmin /> : tab === 'tracking' ? <TrackingAdmin /> : <MetaAdmin />}
        </div>
      </div>
    </WorkspacePage>
  );
}
