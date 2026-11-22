import Link from 'next/link';
import { ArrowRight, FolderHeart, Gem, ImageUp, LibraryBig, Ruler, Settings2, SwatchBook, Type } from 'lucide-react';
import WorkspaceRecoveryPanel from './components/WorkspaceRecoveryPanel';
import RecentDesigns from './components/RecentDesigns';
import StarterGallery from './components/StarterGallery';
import { buildFontLaunchUrl } from './lib/fontLaunch';

const EXAMPLE_FONT_ID = 'archivo-black';
const EXAMPLE_TEXT = 'YOUR NAME';
// On two lines the rhinestone example is large enough to look clean and still fits a 12 x 12 in mat.
const RHINESTONE_EXAMPLE_TEXT = 'YOUR\nNAME';

const goals = [
  {
    href: buildFontLaunchUrl('rhinestone', EXAMPLE_FONT_ID, RHINESTONE_EXAMPLE_TEXT),
    title: 'Make a rhinestone template from text',
    copy: 'Type a name, number or word and get a cut-ready template of stone holes. Opens with an example you can change.',
    icon: Type,
    tone: 'from-brand-500 to-brand-300',
  },
  {
    href: '/rhinestone?tool=svg',
    title: 'Make a rhinestone template from my artwork',
    copy: 'Upload an SVG logo or drawing and fill it with evenly spaced stones.',
    icon: ImageUp,
    tone: 'from-accent-500 to-accent-300',
  },
  {
    href: buildFontLaunchUrl('htv', EXAMPLE_FONT_ID, EXAMPLE_TEXT),
    title: 'Design an HTV transfer',
    copy: 'Lay out text and shapes for heat-transfer vinyl, preview them on a garment and export a cut file.',
    icon: SwatchBook,
    tone: 'from-sand-700 to-sand-500',
  },
] as const;

const workflow = [
  { title: 'Design', copy: 'Type text or upload artwork.' },
  { title: 'Check', copy: 'The tool flags stones that are too close to cut.' },
  { title: 'Export', copy: 'Preview the file, then download the SVG.' },
  { title: 'Cut', copy: 'Open it in Cricut Design Space and cut.' },
] as const;

const moreLinks = [
  { href: '/designs', label: 'My Designs', icon: FolderHeart },
  { href: '/fonts', label: 'Fonts', icon: Type },
  { href: '/library', label: 'Library', icon: LibraryBig },
  { href: '/setup', label: 'Calibrate your material', icon: Ruler },
  { href: '/settings', label: 'Settings', icon: Settings2 },
] as const;

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 py-8 md:px-6 md:py-12">
      <header>
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
          <Gem className="h-4 w-4" aria-hidden="true" />
          Rhinestone Studio
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink md:text-5xl">What do you want to make?</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-ink-secondary">
          Pick a starting point. Each one opens the studio with an example already made, so you can see how it works and change it.
        </p>
      </header>

      <section aria-label="Start a new design" className="grid gap-5 md:grid-cols-3">
        {goals.map((goal) => {
          const Icon = goal.icon;
          return (
            <Link
              key={goal.title}
              href={goal.href}
              className="group overflow-hidden rounded-[1.9rem] border border-border/80 bg-[rgba(255,255,255,0.9)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
            >
              <div className={`h-1.5 rounded-full bg-gradient-to-r ${goal.tone}`} />
              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface text-accent-700">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <ArrowRight className="h-4 w-4 text-ink-muted transition group-hover:translate-x-1 group-hover:text-accent-700" aria-hidden="true" />
              </div>
              <h2 className="mt-5 text-xl font-semibold text-ink">{goal.title}</h2>
              <p className="mt-3 text-sm leading-7 text-ink-secondary">{goal.copy}</p>
            </Link>
          );
        })}
      </section>

      <WorkspaceRecoveryPanel />

      <RecentDesigns />

      <StarterGallery />

      <section aria-label="How it works" className="rounded-[2rem] border border-border/80 bg-surface-raised p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-ink-muted">How it works</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {workflow.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-sm font-semibold text-ink">{index + 1}</span>
              <div>
                <div className="text-sm font-semibold text-ink">{step.title}</div>
                <p className="mt-0.5 text-sm leading-6 text-ink-secondary">{step.copy}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-ink-secondary">
          First time cutting rhinestone templates? <Link href="/setup" className="font-semibold text-accent-600 underline-offset-2 hover:underline">Calibrate your material</Link> once so holes match your stones.
        </p>
      </section>

      <nav aria-label="More" className="flex flex-wrap gap-3">
        {moreLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink-secondary transition hover:bg-surface-raised hover:text-ink"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
