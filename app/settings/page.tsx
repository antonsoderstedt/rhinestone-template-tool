'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CheckCircle2, Ruler, Settings2 } from 'lucide-react';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  type CalibrationProfile,
  type WorkspaceSettings,
  type WorkspaceVault,
  readActiveCalibrationProfileId,
  readWorkspaceVault,
  setActiveCalibrationProfile,
  upsertCalibrationProfile,
  deleteCalibrationProfile,
  writeWorkspaceVault,
} from '../lib/workspaceVault';
import {
  WorkspaceHero,
  WorkspaceMetricCard,
  WorkspacePage,
  WorkspaceSurface,
  workspaceInputClassName,
  workspaceTextAreaClassName,
} from '../components/workspace/WorkspaceChrome';
import WorkspaceQuickActions from '../components/WorkspaceQuickActions';

function persistSettings(nextSettings: WorkspaceSettings, vault: WorkspaceVault, setVault: React.Dispatch<React.SetStateAction<WorkspaceVault>>) {
  const nextVault = { ...vault, settings: nextSettings };
  setVault(nextVault);
  writeWorkspaceVault(nextVault);
}

export default function SettingsPage() {
  const [vault, setVault] = useState<WorkspaceVault>(() => readWorkspaceVault());
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(() => readActiveCalibrationProfileId());

  const settings = vault.settings;
  const update = <K extends keyof WorkspaceSettings>(key: K, value: WorkspaceSettings[K]) => {
    const next = { ...settings, [key]: value };
    persistSettings(next, vault, setVault);
    setSavedAt(new Date().toLocaleTimeString());
  };

  function handleSetActiveProfile(id: string | null) {
    setActiveCalibrationProfile(id);
    setActiveProfileIdState(id);
  }

  function handleToggleApproval(profile: CalibrationProfile) {
    const next: CalibrationProfile = {
      ...profile,
      approvedAt: profile.approvedAt ? undefined : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const nextVault = upsertCalibrationProfile(vault, next);
    setVault(nextVault);
    writeWorkspaceVault(nextVault);
    if (next.approvedAt) handleSetActiveProfile(profile.id);
  }

  function handleDeleteProfile(id: string) {
    const nextVault = deleteCalibrationProfile(vault, id);
    setVault(nextVault);
    writeWorkspaceVault(nextVault);
    if (activeProfileId === id) handleSetActiveProfile(null);
  }

  return (
    <WorkspacePage tone="accent">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
        <WorkspaceQuickActions
          actions={[
            { label: 'Setup & calibration', description: 'Run the production gate before a new material profile is approved.', href: '/setup', icon: Ruler, tone: 'brand' },
            { label: 'Saved work', description: 'Review the latest saved layouts and continue from the right job.', href: '/designs', icon: CheckCircle2, tone: 'neutral' },
            { label: 'Rhinestone studio', description: 'Return to the design surface with the active material profile in context.', href: '/rhinestone', icon: Settings2, tone: 'default' },
            { label: 'HTV studio', description: 'Open the garment workflow and move into production review.', href: '/htv', icon: Settings2, tone: 'neutral' },
          ]}
        />

        <WorkspaceHero
          eyebrow={<><Settings2 className="h-3.5 w-3.5" /> Settings</>}
          title="Operational defaults for the whole workspace"
          description="Keep machine, material, stone, and output preferences together so the rest of the product can become faster, safer, and more predictable over time."
          tone="accent"
          aside={(
            <WorkspaceSurface className="p-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-success-50 px-4 py-2 text-sm font-medium text-success-600">
                <CheckCircle2 className="h-4 w-4" />
                {savedAt ? `Saved locally at ${savedAt}` : 'Changes save to this browser immediately'}
              </div>
            </WorkspaceSurface>
          )}
        />

        <section className="grid gap-4 md:grid-cols-3">
          <WorkspaceMetricCard label="Machine" value={settings.machineModel || 'Unset'} />
          <WorkspaceMetricCard label="Default stone" value={settings.defaultStoneSize || 'Unset'} />
          <WorkspaceMetricCard label="Spacing" value={`${settings.defaultRhinestoneSpacingMm} mm`} />
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

        {/* ── Calibration Profiles ──────────────────────────────────────────── */}
        <WorkspaceSurface className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Ruler className="h-5 w-5 text-accent-600" />
              <h2 className="text-2xl font-semibold text-ink">Calibration Profiles</h2>
            </div>
            <Link
              href="/setup"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink-secondary transition hover:bg-surface-raised hover:text-ink"
            >
              Full workflow →
            </Link>
          </div>
          <p className="mt-2 text-sm leading-7 text-ink-secondary">
            Switch the active profile here, approve it for production, or go to Setup to run the full calibration workflow.
          </p>

          {vault.calibrationProfiles.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-border bg-surface-raised px-6 py-8 text-center">
              <p className="text-sm font-medium text-ink">No calibration profiles saved yet.</p>
              <p className="mt-2 text-xs text-ink-muted">Run the calibration workflow in Setup to create one.</p>
              <Link href="/setup" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-ink-inverse transition hover:bg-sand-800">
                Go to Setup & Calibration
              </Link>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {vault.calibrationProfiles.map((profile) => {
                const isActive = activeProfileId === profile.id;
                const isApproved = Boolean(profile.approvedAt);
                return (
                  <div
                    key={profile.id}
                    className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${isActive ? 'border-accent-300 bg-accent-50' : 'border-border bg-surface-raised'}`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium text-ink">{profile.name}</span>
                        {isActive && (
                          <span className="rounded-full border border-success-300 bg-success-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success-700">Active</span>
                        )}
                        {isApproved ? (
                          <span className="rounded-full border border-success-300 bg-success-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success-700">Approved</span>
                        ) : (
                          <span className="rounded-full border border-warning-300 bg-warning-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning-700">Pending</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">
                        {profile.overrides.length} size overrides · updated {profile.updatedAt.slice(0, 10)}
                        {isApproved ? ` · approved ${profile.approvedAt!.slice(0, 10)}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!isActive && (
                        <button
                          onClick={() => handleSetActiveProfile(profile.id)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-secondary transition hover:bg-surface hover:text-ink"
                        >
                          Set active
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleApproval(profile)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${isApproved ? 'border-warning-300 text-warning-700 hover:bg-warning-50' : 'border-success-300 text-success-700 hover:bg-success-50'}`}
                      >
                        {isApproved ? 'Unapprove' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleDeleteProfile(profile.id)}
                        className="rounded-lg border border-danger-200 px-3 py-1.5 text-xs font-medium text-danger-600 transition hover:bg-danger-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </WorkspaceSurface>
      </div>
    </WorkspacePage>
  );
}

function FormCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <WorkspaceSurface className="p-6">
      <h2 className="text-2xl font-semibold text-ink">{title}</h2>
      <div className="mt-5 space-y-4">{children}</div>
    </WorkspaceSurface>
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
          className={workspaceTextAreaClassName}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={workspaceInputClassName}
        />
      )}
    </label>
  );
}