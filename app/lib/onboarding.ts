/** Remembers that the user closed the getting-started guide. Browser-local, like the rest of the workspace. */
export const ONBOARDING_STORAGE_KEY = 'rhinestone-onboarding-dismissed-v1';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'> & Partial<Pick<Storage, 'removeItem'>>;

export function readOnboardingDismissed(storage: StorageLike | null | undefined): boolean {
  try {
    return storage?.getItem(ONBOARDING_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeOnboardingDismissed(storage: StorageLike | null | undefined): void {
  try {
    storage?.setItem(ONBOARDING_STORAGE_KEY, 'true');
  } catch {
    // Storage can be blocked (private mode); the guide then simply shows again next visit.
  }
}

/** Brings the getting-started guide back (Settings → "Show the quick-start guide again"). */
export function resetOnboarding(storage: StorageLike | null | undefined): void {
  try {
    storage?.removeItem?.(ONBOARDING_STORAGE_KEY);
  } catch {
    // ignore blocked storage
  }
}

export const GETTING_STARTED_STEPS = [
  { title: 'Pick a stone size', detail: 'Choose SS6–SS20 in the panel on the right. SS10 is a good start.' },
  { title: 'Type your text', detail: 'Type a name or word, or tap an example. The design updates as you type.' },
  { title: 'Check the spacing', detail: 'If stones sit too close, switch Spacing to Safe. Warnings show in the status bar.' },
  { title: 'Export', detail: 'Press Export to preview the cut file and download the SVG for your cutter.' },
] as const;
