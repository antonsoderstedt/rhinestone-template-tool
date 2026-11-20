'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock3, ShieldAlert } from 'lucide-react';
import CalibrationSheetGenerator from '../components/CalibrationSheetGenerator';
import CricutTestPack from '../components/CricutTestPack';
import CalibrationWorkflow from '../components/CalibrationWorkflow';
import { WorkspaceHero, WorkspacePage, WorkspaceSurface } from '../components/workspace/WorkspaceChrome';
import { getCalibrationGateSummary } from '../lib/workspaceRecovery';
import { EMPTY_WORKSPACE_VAULT, readActiveCalibrationProfileId, readWorkspaceVault } from '../lib/workspaceVault';

const STEPS = [
  { id: 'test-pack', label: 'Test pack', hint: 'Cut test shapes' },
  { id: 'measure', label: 'Measure', hint: 'Find your hole sizes' },
  { id: 'approve', label: 'Approve', hint: 'Unlock export' },
] as const;
type StepId = (typeof STEPS)[number]['id'];

export default function SetupPage() {
  const [vault, setVault] = useState(() => EMPTY_WORKSPACE_VAULT);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [step, setStep] = useState<StepId>('test-pack');

  useEffect(() => {
    const sync = () => {
      queueMicrotask(() => {
        setVault(readWorkspaceVault());
        setActiveProfileId(readActiveCalibrationProfileId());
      });
    };

    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  const gate = useMemo(() => getCalibrationGateSummary(vault, activeProfileId), [activeProfileId, vault]);
  const ready = gate.workflowState === 'Ready';
  const StatusIcon = ready ? CheckCircle2 : ShieldAlert;
  const stepIndex = STEPS.findIndex((item) => item.id === step);

  return (
    <WorkspacePage tone="accent">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <WorkspaceHero
          eyebrow="Setup & calibration"
          title="Make the holes fit your stones"
          description="Cut a few test shapes, measure which hole sizes seat your stones, then approve them. Export unlocks once your material is approved."
          tone="accent"
          aside={(
            <WorkspaceSurface className="p-5">
              <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${ready ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'}`}>
                <StatusIcon className="h-4 w-4" aria-hidden="true" />
                {ready ? 'Approved — ready to export' : 'Not approved yet'}
              </div>
              <p className="mt-3 text-sm leading-6 text-ink-secondary">{gate.nextStep}</p>
              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-secondary">
                <div><dt className="inline font-semibold text-ink">Active profile: </dt><dd className="inline">{gate.activeProfileName ?? 'none'}</dd></div>
                <div className="flex items-center gap-1">
                  <dt className="inline font-semibold text-ink">Last approval: </dt>
                  <dd className="inline-flex items-center gap-1">
                    {gate.lastApprovedAt ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : <Clock3 className="h-3 w-3" aria-hidden="true" />}
                    {gate.lastApprovedAt ? new Date(gate.lastApprovedAt).toLocaleDateString() : 'not yet'}
                  </dd>
                </div>
              </dl>
            </WorkspaceSurface>
          )}
        />

        <nav aria-label="Setup steps">
          <div role="tablist" aria-label="Setup steps" className="grid gap-3 sm:grid-cols-3">
            {STEPS.map((item, index) => {
              const selected = item.id === step;
              return (
                <button
                  key={item.id}
                  id={`setup-tab-${item.id}`}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  aria-controls={`setup-panel-${item.id}`}
                  onClick={() => setStep(item.id)}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${selected ? 'border-accent-400 bg-surface-raised shadow-sm' : 'border-border bg-surface hover:bg-surface-raised'}`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${selected ? 'bg-accent-600 text-ink-inverse' : 'bg-sand-200 text-ink'}`}>{index + 1}</span>
                  <span>
                    <span className="block text-sm font-semibold text-ink">{item.label}</span>
                    <span className="block text-xs text-ink-secondary">{item.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <WorkspaceSurface className="p-6">
          <div id={`setup-panel-${step}`} role="tabpanel" aria-labelledby={`setup-tab-${step}`} className="space-y-6">
            {step === 'test-pack' && (
              <>
                <div>
                  <h2 className="text-2xl font-semibold text-ink">1. Cut the test pack</h2>
                  <p className="mt-1 text-sm text-ink-secondary">
                    Four ready-to-cut SVGs for checking your Cricut and flock. Start with a small scrap of material.
                  </p>
                </div>
                <CricutTestPack />
              </>
            )}

            {/* One workflow instance for steps 2 and 3 so entered values are shared; it stays mounted. */}
            <div hidden={step === 'test-pack'} className="space-y-6">
              {step === 'measure' && (
                <>
                  <div>
                    <h2 className="text-2xl font-semibold text-ink">2. Measure your hole sizes</h2>
                    <p className="mt-1 text-sm text-ink-secondary">
                      Cut the calibration sheet (stone sizes SS6–SS20), find the hole that seats each stone, and enter it below.
                    </p>
                  </div>
                  <CalibrationSheetGenerator />
                  <div className="border-t border-border" />
                </>
              )}
              {step === 'approve' && (
                <div>
                  <h2 className="text-2xl font-semibold text-ink">3. Save and approve</h2>
                  <p className="mt-1 text-sm text-ink-secondary">
                    Save your measured sizes as a profile and approve it after you have checked that stones seat correctly.
                    Approved profiles unlock export in the studios.
                  </p>
                </div>
              )}
              <CalibrationWorkflow view={step === 'approve' ? 'approve' : 'measure'} />
            </div>
          </div>
        </WorkspaceSurface>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={stepIndex === 0}
            onClick={() => setStep(STEPS[stepIndex - 1]!.id)}
            className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink-secondary transition hover:bg-surface-raised hover:text-ink disabled:invisible"
          >
            ← Back
          </button>
          {stepIndex < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep(STEPS[stepIndex + 1]!.id)}
              className="rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-ink-inverse transition hover:bg-sand-800"
            >
              Next: {STEPS[stepIndex + 1]!.label} →
            </button>
          ) : (
            <Link href="/rhinestone" className="rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-ink-inverse transition hover:bg-sand-800">
              Back to the studio →
            </Link>
          )}
        </div>

        <p className="text-xs leading-relaxed text-ink-muted">
          Exported SVGs use real <code>&lt;circle&gt;</code> elements sized in mm. The stone sizes shown are starting values, not
          measurements — always cut a test sheet before production.
        </p>
      </div>
    </WorkspacePage>
  );
}
