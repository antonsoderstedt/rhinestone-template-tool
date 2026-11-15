'use client';

import { useState, useMemo, useEffect, useRef, type ChangeEvent } from 'react';
import {
  createCalibrationOverrideSet,
  applyCalibrationOverridesToTemplate,
  createStoneGridTemplate,
  createBasicSvgExport,
  checkExportReadiness,
  getRecommendedHoleDiameter,
  getStoneSizeProfile,
  isHolePresetProvisional,
  MAGIC_FLOCK_CRICUT_MAKER_PROFILE,
  MAGIC_FLOCK_CRICUT_MAKER_3_RECOMMENDATION,
} from '@/src/lib/rhinestone-engine/index';
import type { StoneSizeId, ExportReadinessResult } from '@/src/lib/rhinestone-engine/index';
import {
  deleteCalibrationProfile,
  makeWorkspaceId,
  readActiveCalibrationProfileId,
  readWorkspaceVault,
  setActiveCalibrationProfile,
  upsertCalibrationProfile,
  writeWorkspaceVault,
} from '@/app/lib/workspaceVault';
import type { CalibrationProfile } from '@/app/lib/workspaceVault';
import ExportReadinessPanel from './ExportReadinessPanel';
import SvgExportActions from './SvgExportActions';
import MachineCutSettingsCard from './MachineCutSettingsCard';
import Badge from '@/app/editor/ui/Badge';

// ─── Constants ────────────────────────────────────────────────────────────────

const PROFILE_ID = 'magic-flock-cricut-maker';
const CALIBRATION_STORAGE_KEY = 'rhinestone-calibration-values-v1';

// All stone sizes Magic Flock supports (matches MAGIC_FLOCK_CRICUT_MAKER_PROFILE.supportedStoneSizes).
const STONE_SIZES: StoneSizeId[] = [...MAGIC_FLOCK_CRICUT_MAKER_PROFILE.supportedStoneSizes];

function readStoredCalibration(): HoleMap | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<Record<StoneSizeId, string>>;
    const next: HoleMap = defaultHoleMap();

    for (const size of STONE_SIZES) {
      const value = parsed[size];
      if (typeof value === 'string' && value.trim().length > 0) {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric > 0) {
          next[size] = value;
        }
      }
    }

    return next;
  } catch {
    return null;
  }
}

/** Returns the recommended hole diameter for a stone size from the engine. */
function recommended(size: StoneSizeId): number {
  return getRecommendedHoleDiameter(size, PROFILE_ID);
}

/** Returns the stone physical diameter for display. */
function physicalDiameter(size: StoneSizeId): number {
  return getStoneSizeProfile(size).stoneDiameterMm;
}

// ─── State type ───────────────────────────────────────────────────────────────

type HoleMap = Record<StoneSizeId, string>; // string for controlled input

function defaultHoleMap(): HoleMap {
  return {
    SS6:  recommended('SS6').toString(),
    SS8:  recommended('SS8').toString(),
    SS10: recommended('SS10').toString(),
    SS12: recommended('SS12').toString(),
    SS16: recommended('SS16').toString(),
    SS20: recommended('SS20').toString(),
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CalibrationWorkflow() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [holeMap, setHoleMap] = useState<HoleMap>(() => readStoredCalibration() ?? defaultHoleMap());
  const [profileName, setProfileName] = useState('My calibrated setup');
  const [savedProfiles, setSavedProfiles] = useState<CalibrationProfile[]>(() => readWorkspaceVault().calibrationProfiles);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(() => readActiveCalibrationProfileId());
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(holeMap));
  }, [holeMap]);

  useEffect(() => {
    setActiveCalibrationProfile(activeProfileId);
  }, [activeProfileId]);

  useEffect(() => {
    const vault = readWorkspaceVault();
    writeWorkspaceVault({ ...vault, calibrationProfiles: savedProfiles });
  }, [savedProfiles]);

  /** Parsed numeric values — NaN if input is invalid. */
  const parsed = useMemo<Record<StoneSizeId, number>>(
    () => ({
      SS6:  parseFloat(holeMap.SS6),
      SS8:  parseFloat(holeMap.SS8),
      SS10: parseFloat(holeMap.SS10),
      SS12: parseFloat(holeMap.SS12),
      SS16: parseFloat(holeMap.SS16),
      SS20: parseFloat(holeMap.SS20),
    }),
    [holeMap],
  );

  const anyInvalid = STONE_SIZES.some((s) => isNaN(parsed[s]) || parsed[s] <= 0);

  /** Calibrated SS10 test grid with overrides applied. */
  type CalibResult =
    | { ok: true; svg: string; readiness: ExportReadinessResult }
    | { ok: false; error: string };

  const calibResult = useMemo<CalibResult>(() => {
    if (anyInvalid) return { ok: false, error: 'Enter valid hole diameters above.' };
    try {
      const overrideSet = createCalibrationOverrideSet({
        id: 'workflow-overrides',
        name: 'My Calibrated Values',
        materialProfileId: PROFILE_ID,
        overrides: STONE_SIZES.map((s) => ({
          stoneSize: s,
          holeDiameterMm: parsed[s],
        })),
      });

      const base = createStoneGridTemplate({
        id: 'calib-preview',
        name: 'Calibrated SS10 Test Grid',
        stoneSize: 'SS10',
        columns: 5,
        rows: 3,
        materialProfileId: PROFILE_ID,
      });

      const calibrated = applyCalibrationOverridesToTemplate(base, overrideSet);
      const readiness = checkExportReadiness(calibrated, { requireCalibration: false });
      const svg = createBasicSvgExport(calibrated, {
        includeGuideBox: true,
        includeLabels: false,
        paddingMm: 5,
        decimalPlaces: 3,
      });
      return { ok: true, svg, readiness };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }, [parsed, anyInvalid]);

  function handleChange(size: StoneSizeId, value: string) {
    setHoleMap((prev) => ({ ...prev, [size]: value }));
  }

  function handleReset() {
    setHoleMap(defaultHoleMap());
  }

  function handleClearSavedCalibration() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(CALIBRATION_STORAGE_KEY);
    }
    setHoleMap(defaultHoleMap());
  }

  function handleSaveProfile() {
    const name = profileName.trim() || `Calibration ${new Date().toLocaleDateString()}`;
    const existing = savedProfiles.find((profile) => profile.name.trim().toLowerCase() === name.toLowerCase());
    const now = new Date().toISOString();
    const profile: CalibrationProfile = {
      id: existing?.id ?? makeWorkspaceId('calibration-profile'),
      name,
      materialProfileId: PROFILE_ID,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      approvedAt: existing?.approvedAt,
      overrides: STONE_SIZES.map((size) => ({
        stoneSize: size,
        holeDiameterMm: Number.parseFloat(holeMap[size]),
      })),
    };

    const vault = readWorkspaceVault();
    const nextVault = upsertCalibrationProfile(vault, profile);
    writeWorkspaceVault(nextVault);
    setSavedProfiles(nextVault.calibrationProfiles);
    setActiveProfileId(profile.id);
    setProfileName(name);
  }

  function handleToggleApproval(profile: CalibrationProfile) {
    const nextProfile: CalibrationProfile = {
      ...profile,
      approvedAt: profile.approvedAt ? undefined : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const vault = readWorkspaceVault();
    const nextVault = upsertCalibrationProfile(vault, nextProfile);
    writeWorkspaceVault(nextVault);
    setSavedProfiles(nextVault.calibrationProfiles);
    if (nextProfile.approvedAt) {
      setActiveProfileId(profile.id);
    }
  }

  function handleExportProfiles() {
    const vault = readWorkspaceVault();
    const payload = { exportedAt: new Date().toISOString(), profiles: vault.calibrationProfiles };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'magic-flock-calibration-profiles.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function handleImportProfiles(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text) as { profiles?: unknown } | unknown[] | null;
      const records = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.profiles)
          ? payload.profiles
          : [];

      const importedProfiles: CalibrationProfile[] = records
        .filter((record): record is Record<string, unknown> => !!record && typeof record === 'object')
        .map((record) => ({
          id: typeof record.id === 'string' && record.id.trim().length > 0 ? record.id : makeWorkspaceId('calibration-profile'),
          name: typeof record.name === 'string' && record.name.trim().length > 0 ? record.name.trim() : 'Imported calibration',
          materialProfileId: typeof record.materialProfileId === 'string' && record.materialProfileId.trim().length > 0 ? record.materialProfileId : PROFILE_ID,
          createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
          updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString(),
          overrides: Array.isArray(record.overrides)
            ? record.overrides
                .filter((override): override is Record<string, unknown> => !!override && typeof override === 'object')
                .map((override) => ({
                  stoneSize: typeof override.stoneSize === 'string' ? override.stoneSize : 'SS10',
                  holeDiameterMm: typeof override.holeDiameterMm === 'number' && Number.isFinite(override.holeDiameterMm) && override.holeDiameterMm > 0
                    ? override.holeDiameterMm
                    : 3.43,
                  notes: typeof override.notes === 'string' ? override.notes : undefined,
                }))
            : [],
        }));

      if (importedProfiles.length === 0) {
        throw new Error('No valid calibration profiles were found in the file.');
      }

      const vault = readWorkspaceVault();
      const merged = [...vault.calibrationProfiles, ...importedProfiles];
      const deduplicated = Array.from(new Map(merged.map((profile) => [profile.id, profile])).values())
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      writeWorkspaceVault({ ...vault, calibrationProfiles: deduplicated });
      setSavedProfiles(deduplicated);
      setImportError(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Could not import calibration profiles.');
    } finally {
      event.target.value = '';
    }
  }

  function handleApplyProfile(profile: CalibrationProfile) {
    const next: HoleMap = defaultHoleMap();
    for (const override of profile.overrides) {
      if (STONE_SIZES.includes(override.stoneSize as StoneSizeId)) {
        next[override.stoneSize as StoneSizeId] = override.holeDiameterMm.toString();
      }
    }
    setHoleMap(next);
    setProfileName(profile.name);
    setActiveProfileId(profile.id);
  }

  function handleDeleteProfile(profileId: string) {
    const vault = readWorkspaceVault();
    const nextVault = deleteCalibrationProfile(vault, profileId);
    writeWorkspaceVault(nextVault);
    setSavedProfiles(nextVault.calibrationProfiles);
    if (activeProfileId === profileId) {
      setActiveProfileId(null);
    }
  }

  function getProfileStatus(profile: CalibrationProfile): 'recommended' | 'custom' {
    const hasCustomValue = profile.overrides.some((override) => {
      const value = Number.parseFloat(String(override.holeDiameterMm));
      const recommendedValue = getRecommendedHoleDiameter(override.stoneSize as StoneSizeId, PROFILE_ID);
      return Math.abs(value - recommendedValue) > 0.001;
    });
    return hasCustomValue ? 'custom' : 'recommended';
  }

  const activeProfile = savedProfiles.find((profile) => profile.id === activeProfileId) ?? null;
  const approvedProfiles = savedProfiles.filter((profile) => profile.approvedAt);
  const productionReady = Boolean(activeProfile?.approvedAt);
  const hasMeasuredValues = STONE_SIZES.some((size) => {
    const value = Number.parseFloat(holeMap[size]);
    return Number.isFinite(value) && value > 0;
  });
  const gateStatus = productionReady
    ? 'Ready to produce'
    : activeProfile
      ? 'Approval needed'
      : hasMeasuredValues
        ? 'Save and approve'
        : 'Cut and measure first';

  return (
    <div className="flex flex-col gap-6">
      <div className={`rounded-2xl border p-5 ${productionReady ? 'border-emerald-400/40 bg-emerald-500/10' : activeProfile ? 'border-amber-400/40 bg-amber-500/10' : 'border-border bg-sand-50'}`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">Production gate</p>
            <h3 className="mt-2 text-2xl font-semibold text-ink">{gateStatus}</h3>
          </div>
          <Badge tone={productionReady ? 'success' : activeProfile ? 'warning' : 'info'}>
            {productionReady ? 'Approved' : activeProfile ? 'Pending approval' : 'Not started'}
          </Badge>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className={`rounded-xl border p-3 ${hasMeasuredValues ? 'border-emerald-300 bg-emerald-50' : 'border-border bg-white'}`}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">Step 1</div>
            <div className="mt-2 text-sm font-semibold text-ink">Cut calibration sheet</div>
            <p className="mt-1 text-xs text-ink-secondary">{hasMeasuredValues ? 'Measured values are present.' : 'Use the calibration sheet before production.'}</p>
          </div>
          <div className={`rounded-xl border p-3 ${hasMeasuredValues ? 'border-emerald-300 bg-emerald-50' : 'border-border bg-white'}`}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">Step 2</div>
            <div className="mt-2 text-sm font-semibold text-ink">Validate hole sizes</div>
            <p className="mt-1 text-xs text-ink-secondary">{hasMeasuredValues ? 'The current values are ready for preview.' : 'Enter measured hole diameters in mm.'}</p>
          </div>
          <div className={`rounded-xl border p-3 ${productionReady ? 'border-emerald-300 bg-emerald-50' : activeProfile ? 'border-amber-300 bg-amber-50' : 'border-border bg-white'}`}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">Step 3</div>
            <div className="mt-2 text-sm font-semibold text-ink">Approve profile</div>
            <p className="mt-1 text-xs text-ink-secondary">{productionReady ? 'This profile is approved and ready.' : activeProfile ? 'Approve the active profile before export.' : 'Save a profile and approve it when the cut passes.'}</p>
          </div>
        </div>
      </div>

      {/* ── Machine cut settings (separate from template settings below) ──── */}
      <MachineCutSettingsCard recommendation={MAGIC_FLOCK_CRICUT_MAKER_3_RECOMMENDATION} />

      {/* ── Explanation ──────────────────────────────────────────────────── */}
      <div className="rounded-lg bg-warning-50 border border-warning-500/30 px-5 py-4 text-sm text-warning-600 leading-relaxed">
        <p className="font-semibold mb-1">Template settings — how to calibrate hole diameter</p>
        <ol className="ml-4 list-decimal space-y-1 text-xs">
          <li>Download and cut the <strong>Calibration Sheet</strong> on a scrap of Magic Flock.</li>
          <li>Place stones in each hole and find which diameter seats correctly.</li>
          <li>Enter those measured hole diameters below (one per stone size).</li>
          <li>Use the calibrated preview grid to verify before production.</li>
        </ol>
        <p className="mt-2 text-xs text-warning-600">
          ⚠ Calibration values are saved in this browser and restored automatically when you return.
          Clear saved values any time you want to start over from the recommended defaults.
        </p>
      </div>

      {/* ── Input fields ─────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold text-ink-secondary">Enter calibrated hole diameters (mm)</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="text-xs text-ink-muted hover:text-ink underline underline-offset-2"
            >
              Reset to recommended
            </button>
            <button
              onClick={handleClearSavedCalibration}
              className="text-xs text-danger-600 hover:text-danger-700 underline underline-offset-2"
            >
              Clear saved
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STONE_SIZES.map((size) => {
            const val = holeMap[size];
            const num = parseFloat(val);
            const invalid = isNaN(num) || num <= 0;
            const rec = recommended(size);
            const diff = !invalid ? (num - rec) : null;
            return (
              <div key={size} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-muted flex items-center gap-1.5" htmlFor={`hole-${size}`}>
                  {size} <span className="text-ink-secondary">({physicalDiameter(size)} mm stone)</span>
                  {isHolePresetProvisional(size, PROFILE_ID) && <Badge tone="warning">Provisional</Badge>}
                </label>
                <input
                  id={`hole-${size}`}
                  type="number"
                  min={0.1}
                  step={0.05}
                  value={val}
                  onChange={(e) => handleChange(size, e.target.value)}
                  className={`rounded border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 ${
                    invalid
                      ? 'border-danger-500 bg-danger-50 focus:ring-danger-400'
                      : 'border-border-strong focus:ring-accent-400'
                  }`}
                />
                {!invalid && diff !== null && (
                  <span className={`text-xs ${Math.abs(diff) < 0.001 ? 'text-ink-secondary' : diff > 0 ? 'text-warning-600' : 'text-info-600'}`}>
                    {diff > 0 ? '+' : ''}{diff.toFixed(3)} mm vs recommended
                  </span>
                )}
                {invalid && (
                  <span className="text-xs text-danger-500">Enter a value &gt; 0</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Production checklist ─────────────────────────────────────────── */}
      <div className={`rounded-lg border p-4 ${productionReady ? 'border-success-400 bg-success-50' : activeProfile ? 'border-warning-400 bg-warning-50' : 'border-border bg-sand-50'}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Production readiness</p>
            <p className="mt-1 text-lg font-semibold text-ink">
              {productionReady ? 'Ready for production' : activeProfile ? 'Custom setup loaded' : 'Calibration required'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {productionReady && <Badge tone="success">Approved</Badge>}
            {activeProfile && !productionReady && <Badge tone="warning">Needs approval</Badge>}
            {!activeProfile && <Badge tone="info">No active profile</Badge>}
          </div>
        </div>
        <ul className="mt-3 space-y-1 text-xs text-ink-muted">
          <li>• {approvedProfiles.length > 0 ? `${approvedProfiles.length} approved profile${approvedProfiles.length === 1 ? '' : 's'} saved` : 'No approved calibration profiles yet'}</li>
          <li>• {activeProfile ? `Active profile: ${activeProfile.name}` : 'Choose or save a calibration profile before production'}</li>
          <li>• {productionReady ? 'The active profile is approved for production use.' : 'Approve a profile after test-cut validation.'}</li>
        </ul>
      </div>

      {/* ── Save profile ───────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-sand-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="calibration-profile-name" className="mb-1 block text-xs font-medium text-ink-muted uppercase tracking-wide">
              Save current calibration
            </label>
            <input
              id="calibration-profile-name"
              type="text"
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
              placeholder="My calibrated setup"
              className="w-full rounded border border-border-strong bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSaveProfile}
              className="rounded bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700"
            >
              Save profile
            </button>
            <button
              onClick={handleExportProfiles}
              className="rounded border border-border px-3 py-2 text-sm font-medium text-ink hover:bg-sand-50"
            >
              Export JSON
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded border border-border px-3 py-2 text-sm font-medium text-ink hover:bg-sand-50"
            >
              Import JSON
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImportProfiles}
        />

        {importError && (
          <p className="mt-2 text-xs text-danger-600">{importError}</p>
        )}

        {savedProfiles.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Saved profiles</p>
            {savedProfiles.map((profile) => {
              const isActive = activeProfileId === profile.id;
              const status = getProfileStatus(profile);
              return (
                <div key={profile.id} className="flex flex-col gap-2 rounded border border-border bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-ink">{profile.name}</p>
                      {isActive && <Badge tone="success">Active</Badge>}
                      {profile.approvedAt && <Badge tone="success">Approved</Badge>}
                      <Badge tone={status === 'custom' ? 'warning' : 'info'}>{status === 'custom' ? 'Custom' : 'Recommended'}</Badge>
                    </div>
                    <p className="text-xs text-ink-muted">
                      {profile.updatedAt.slice(0, 10)} · {profile.overrides.length} sizes
                      {profile.approvedAt ? ` · approved ${profile.approvedAt.slice(0, 10)}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => handleApplyProfile(profile)}
                      className="rounded border border-border px-2.5 py-1.5 text-xs text-ink hover:bg-sand-50"
                    >
                      {isActive ? 'Use again' : 'Apply'}
                    </button>
                    <button
                      onClick={() => handleToggleApproval(profile)}
                      className="rounded border border-border px-2.5 py-1.5 text-xs text-ink hover:bg-sand-50"
                    >
                      {profile.approvedAt ? 'Unapprove' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleDeleteProfile(profile.id)}
                      className="rounded border border-danger-300 px-2.5 py-1.5 text-xs text-danger-600 hover:bg-danger-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Comparison table ─────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-sand-100 text-ink-muted uppercase tracking-wide text-[10px]">
              <th className="text-left px-3 py-2">Size</th>
              <th className="text-right px-3 py-2">Stone Ø</th>
              <th className="text-right px-3 py-2">Recommended hole</th>
              <th className="text-right px-3 py-2">Calibrated hole</th>
              <th className="text-right px-3 py-2">Δ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {STONE_SIZES.map((size) => {
              const rec  = recommended(size);
              const num  = parseFloat(holeMap[size]);
              const invalid = isNaN(num) || num <= 0;
              const diff = !invalid ? num - rec : null;
              return (
                <tr key={size} className="hover:bg-sand-50">
                  <td className="px-3 py-2 font-semibold text-ink">
                    <span className="flex items-center gap-1.5">
                      {size}
                      {isHolePresetProvisional(size, PROFILE_ID) && <Badge tone="warning">Provisional</Badge>}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-ink-muted">{physicalDiameter(size)} mm</td>
                  <td className="px-3 py-2 text-right text-ink-muted">{rec.toFixed(2)} mm</td>
                  <td className="px-3 py-2 text-right font-medium text-ink">
                    {invalid ? <span className="text-danger-500">—</span> : `${num.toFixed(2)} mm`}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono ${
                    diff === null ? 'text-ink-secondary' :
                    Math.abs(diff) < 0.001 ? 'text-ink-secondary' :
                    diff > 0 ? 'text-warning-600' : 'text-info-600'
                  }`}>
                    {diff === null ? '—' : `${diff >= 0 ? '+' : ''}${diff.toFixed(3)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Calibrated preview ───────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-ink-secondary mb-3">
          Calibrated SS10 Test Grid (5×3)
        </h3>

        {!calibResult.ok ? (
          <div className="rounded border border-danger-500/30 bg-danger-50 p-3 text-sm text-danger-600">
            {calibResult.error}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <ExportReadinessPanel result={calibResult.readiness} />
            <SvgExportActions
              svg={calibResult.svg}
              filename={`rhinestone-calibrated-ss10-5x3.svg`}
              disabled={!calibResult.readiness.ready}
            />
          </div>
        )}
      </div>

    </div>
  );
}
