'use client';

import { useState } from 'react';
import { CheckCircle2, Settings2 } from 'lucide-react';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  type WorkspaceSettings,
  type WorkspaceVault,
  readWorkspaceVault,
  writeWorkspaceVault,
} from '../lib/workspaceVault';

function persistSettings(nextSettings: WorkspaceSettings, vault: WorkspaceVault, setVault: React.Dispatch<React.SetStateAction<WorkspaceVault>>) {
  const nextVault = { ...vault, settings: nextSettings };
  setVault(nextVault);
  writeWorkspaceVault(nextVault);
}

export default function SettingsPage() {
  const [vault, setVault] = useState<WorkspaceVault>(() => readWorkspaceVault());
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const settings = vault.settings;
  const update = <K extends keyof WorkspaceSettings>(key: K, value: WorkspaceSettings[K]) => {
    const next = { ...settings, [key]: value };
    persistSettings(next, vault, setVault);
    setSavedAt(new Date().toLocaleTimeString());
  };

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(124,77,255,0.12),transparent_26%),linear-gradient(180deg,#faf8f5_0%,#f6f1e8_100%)] px-4 py-8 md:px-6">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
        <section className="rounded-[2.5rem] border border-border bg-surface-raised/90 p-8 shadow-xl shadow-sand-900/5">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent-500/15 bg-accent-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent-700">
            <Settings2 className="h-3.5 w-3.5" />
            Settings
          </div>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight text-ink">Operational defaults for the whole workspace</h1>
          <p className="mt-4 max-w-4xl text-base leading-8 text-ink-secondary md:text-lg">
            Keep your machine, material, stone, and output preferences together so the rest of the product can become faster, safer, and more predictable over time.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-success-50 px-4 py-2 text-sm font-medium text-success-600">
            <CheckCircle2 className="h-4 w-4" />
            {savedAt ? `Saved locally at ${savedAt}` : 'Changes save to this browser immediately'}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <FormCard title="Machine">
            <Field label="Machine model" value={settings.machineModel} onChange={(value) => update('machineModel', value)} />
            <Field label="Cutting mat" value={settings.cuttingMat} onChange={(value) => update('cuttingMat', value)} />
            <Field label="Blade strategy" value={settings.bladeStrategy} onChange={(value) => update('bladeStrategy', value)} multiline />
          </FormCard>

          <FormCard title="Materials">
            <Field label="Default rhinestone material" value={settings.defaultMaterial} onChange={(value) => update('defaultMaterial', value)} />
            <Field label="Default flock" value={settings.defaultFlock} onChange={(value) => update('defaultFlock', value)} />
            <Field label="Default HTV carrier" value={settings.defaultHtvCarrier} onChange={(value) => update('defaultHtvCarrier', value)} />
          </FormCard>

          <FormCard title="Production defaults">
            <Field label="Default stone size" value={settings.defaultStoneSize} onChange={(value) => update('defaultStoneSize', value)} />
            <Field
              label="Default rhinestone spacing (mm)"
              value={String(settings.defaultRhinestoneSpacingMm)}
              onChange={(value) => update('defaultRhinestoneSpacingMm', Number(value) || DEFAULT_WORKSPACE_SETTINGS.defaultRhinestoneSpacingMm)}
            />
            <Field
              label="HTV weed margin (mm)"
              value={String(settings.htvWeedMarginMm)}
              onChange={(value) => update('htvWeedMarginMm', Number(value) || DEFAULT_WORKSPACE_SETTINGS.htvWeedMarginMm)}
            />
          </FormCard>

          <FormCard title="Workspace rules">
            <Field label="Output folder hint" value={settings.outputFolderHint} onChange={(value) => update('outputFolderHint', value)} />
            <Field label="Quality checklist" value={settings.qualityChecklist} onChange={(value) => update('qualityChecklist', value)} multiline />
          </FormCard>
        </section>
      </div>
    </div>
  );
}

function FormCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-border bg-surface-raised p-6 shadow-lg shadow-sand-900/5">
      <h2 className="text-2xl font-semibold text-ink">{title}</h2>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-ink-secondary">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-accent-300"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-accent-300"
        />
      )}
    </label>
  );
}