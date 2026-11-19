'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle2, Ruler, Settings2 } from 'lucide-react';
import {
  type CalibrationProfile,
  type WorkspaceVault,
  EMPTY_WORKSPACE_VAULT,
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
} from '../components/workspace/WorkspaceChrome';
import WorkspaceQuickActions from '../components/WorkspaceQuickActions';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  SETTINGS_DENSITY_PRESETS,
  SETTINGS_STONE_SIZES,
  WORKSPACE_SETTING_LIMITS,
  type SettingsDensityPreset,
  type WorkspaceSettings,
} from '../lib/workspaceSettings';

const DENSITY_LABELS: Record<SettingsDensityPreset, string> = {
  safe: 'Safe — extra gap, easiest to cut',
  standard: 'Standard — recommended spacing',
  dense: 'Dense — tight, calibrate first',
  loose: 'Loose — open, decorative',
};

function persistSettings(nextSettings: WorkspaceSettings, vault: WorkspaceVault, setVault: React.Dispatch<React.SetStateAction<WorkspaceVault>>) {
  const nextVault = { ...vault, settings: nextSettings };
  setVault(nextVault);
  writeWorkspaceVault(nextVault);
}

export default function SettingsPage() {
  const [vault, setVault] = useState<WorkspaceVault>(EMPTY_WORKSPACE_VAULT);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setVault(readWorkspaceVault());
      setActiveProfileIdState(readActiveCalibrationProfileId());
    });
  }, []);

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
          title="Defaults for new projects"
          description="Choose what a new project starts with. Every setting here is used by the studios; changes apply to new projects and never alter work you already saved."
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

        <section className="grid gap-5 xl:grid-cols-2">
          <FormCard title="New rhinestone projects" note="Applies to new projects. Open designs keep their own values.">
            <SelectField
              label="Stone size"
              value={settings.defaultStoneSize}
              options={SETTINGS_STONE_SIZES.map((size) => ({ value: size, label: size }))}
              onChange={(value) => update('defaultStoneSize', value as WorkspaceSettings['defaultStoneSize'])}
            />
            <SelectField
              label="Spacing"
              hint="Centre distance is worked out from the stone size and your material, so it always stays cuttable."
              value={settings.defaultDensityPreset}
              options={SETTINGS_DENSITY_PRESETS.map((preset) => ({ value: preset, label: DENSITY_LABELS[preset] }))}
              onChange={(value) => update('defaultDensityPreset', value as SettingsDensityPreset)}
            />
            <NumberField
              label="Uploaded artwork size (mm, longest side)"
              hint="SVGs you upload are scaled to this size first. You can still resize them."
              value={settings.defaultArtworkLongestSideMm}
              {...WORKSPACE_SETTING_LIMITS.defaultArtworkLongestSideMm}
              onCommit={(value) => update('defaultArtworkLongestSideMm', value)}
            />
          </FormCard>

          <FormCard title="HTV export" note="Used the next time you export from the HTV studio.">
            <NumberField
              label="Weed margin (mm)"
              hint="Empty space kept around the artwork in the exported cut file."
              value={settings.htvWeedMarginMm}
              {...WORKSPACE_SETTING_LIMITS.htvWeedMarginMm}
              onCommit={(value) => update('htvWeedMarginMm', value)}
            />
          </FormCard>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              persistSettings({ ...DEFAULT_WORKSPACE_SETTINGS }, vault, setVault);
              setSavedAt(new Date().toLocaleTimeString());
            }}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink-secondary transition hover:bg-surface-raised hover:text-ink"
          >
            Reset to recommended defaults
          </button>
        </div>

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

function FormCard({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <WorkspaceSurface className="p-6">
      <h2 className="text-2xl font-semibold text-ink">{title}</h2>
      {note && <p className="mt-1 text-sm text-ink-muted">{note}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </WorkspaceSurface>
  );
}

function SelectField({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-ink-secondary">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={workspaceInputClassName}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {hint && <span className="block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}

/**
 * Number input that keeps what the user is typing while it is out of range and
 * only saves a value that is valid, so a half-typed "1" never becomes a setting.
 */
function NumberField({
  label,
  hint,
  value,
  min,
  max,
  onCommit,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const parsed = draft.trim() === '' ? NaN : Number(draft);
  const valid = Number.isFinite(parsed) && parsed >= min && parsed <= max;
  const shown = editing ? draft : String(value);

  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-ink-secondary">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step="any"
        value={shown}
        aria-invalid={editing && !valid ? true : undefined}
        onFocus={() => {
          setDraft(String(value));
          setEditing(true);
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          const next = event.target.value.trim() === '' ? NaN : Number(event.target.value);
          if (Number.isFinite(next) && next >= min && next <= max) onCommit(next);
        }}
        onBlur={() => setEditing(false)}
        className={workspaceInputClassName}
      />
      {editing && !valid ? (
        <span role="alert" className="block text-xs text-danger-600">Enter a number from {min} to {max}.</span>
      ) : (
        hint && <span className="block text-xs text-ink-muted">{hint}</span>
      )}
    </label>
  );
}
