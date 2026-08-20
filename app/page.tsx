import Link from 'next/link';
import { Bebas_Neue, Sora } from 'next/font/google';
import { ArrowRight, FolderHeart, Gem, LibraryBig, Layers3, Settings2, SwatchBook, Type } from 'lucide-react';

const display = Bebas_Neue({ subsets: ['latin'], weight: '400' });
const sora = Sora({ subsets: ['latin'], variable: '--font-sora' });

const toolCards = [
  {
    href: '/rhinestone',
    title: 'Rhinestone Studio',
    copy: 'Generate templates, tune spacing, preview garments, calibrate output, and export mm-accurate SVG files for production.',
    icon: Gem,
    tone: 'from-brand-500 to-brand-300',
  },
  {
    href: '/htv',
    title: 'HTV Studio',
    copy: 'Build layered vinyl artwork, trace silhouettes, preview placements, and export clean vector cut files.',
    icon: SwatchBook,
    tone: 'from-accent-500 to-accent-300',
  },
  {
    href: '/library',
    title: 'Library',
    copy: 'Collect assets, bulk upload, tag, filter, sort, and launch the right artwork directly into the right studio.',
    icon: LibraryBig,
    tone: 'from-sand-700 to-sand-500',
  },
  {
    href: '/fonts',
    title: 'Fonts',
    copy: 'Preview every typeface on one phrase, compare styles at a glance, and keep your font catalog organized.',
    icon: Type,
    tone: 'from-brand-500 to-accent-500',
  },
];

const audienceCards = [
  {
    title: 'Solo creator',
    copy: 'Fast launch points for custom tees, competition wear, gifting, and on-demand production.',
    href: '/rhinestone',
  },
  {
    title: 'Studio workflow',
    copy: 'Shared assets, repeatable material settings, favorites, previews, and saved designs that stay easy to reopen.',
    href: '/designs',
  },
  {
    title: 'Sales-ready catalog',
    copy: 'Build reusable libraries of artwork, fonts, placements, and production defaults so every order starts faster.',
    href: '/library',
  },
];

const workflowSteps = [
  {
    title: 'Build',
    copy: 'Generate rhinestone layouts or layered HTV artwork with tighter defaults and clearer controls.',
  },
  {
    title: 'Organize',
    copy: 'Keep assets, fonts, and saved designs in one operating system instead of scattered folders.',
  },
  {
    title: 'Produce',
    copy: 'Move from preview to export with calibrated settings and fewer manual checks.',
  },
] as const;

const proofStats = [
  { value: '2', label: 'Dedicated studios' },
  { value: '1', label: 'Shared workspace system' },
  { value: 'MM', label: 'Native production units' },
] as const;

export default function Home() {
  return (
    <div className={`${sora.variable}`}>
      <section className="mx-auto grid w-full max-w-[1560px] gap-6 px-4 py-6 md:px-6 md:py-8 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="overflow-hidden rounded-[2rem] border border-border/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(247,242,236,0.92))] shadow-[0_20px_70px_rgba(36,31,23,0.08)]">
          <div className="border-b border-border/80 px-6 py-4 md:px-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/15 bg-brand-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-700">
              Production workspace
            </div>
          </div>
          <div className="grid gap-8 px-6 py-8 md:px-8 md:py-10 xl:grid-cols-[1.1fr_0.9fr] xl:items-end">
            <div className="max-w-4xl">
              <h1 className={`${display.className} text-5xl leading-[0.9] tracking-[0.05em] text-ink md:text-7xl xl:text-[7.5rem]`}>
                Design ops for rhinestone and HTV teams.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-ink-secondary md:text-lg">
                A calmer, more serious workspace for building artwork, comparing fonts, organizing assets, and moving designs into production without the usual folder sprawl.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/rhinestone"
                  className="inline-flex items-center gap-2 rounded-2xl bg-ink px-6 py-3 text-sm font-semibold text-ink-inverse shadow-lg shadow-sand-900/15 transition hover:bg-sand-800"
                >
                  Open Rhinestone Studio
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/htv"
                  className="inline-flex items-center gap-2 rounded-2xl border border-border-strong bg-surface-raised px-6 py-3 text-sm font-semibold text-ink transition hover:border-accent-300 hover:text-accent-700"
                >
                  Open HTV Studio
                </Link>
                <Link
                  href="/designs"
                  className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface px-6 py-3 text-sm font-medium text-ink-secondary transition hover:bg-surface-raised hover:text-ink"
                >
                  Review saved work
                </Link>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[1.75rem] border border-border bg-[rgba(255,255,255,0.82)] p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-muted">Operator view</div>
                    <p className="mt-2 text-sm leading-7 text-ink-secondary">
                      Move between studios, assets, fonts, and production settings without leaving the same workspace system.
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-700">
                    <Layers3 className="h-5 w-5" />
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                {proofStats.map((item) => (
                  <div key={item.label} className="rounded-[1.5rem] border border-border bg-surface-raised px-4 py-4 shadow-sm">
                    <div className="text-2xl font-semibold text-ink">{item.value}</div>
                    <div className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5">
          <div className="rounded-[2rem] border border-border/80 bg-[rgba(255,255,255,0.85)] p-6 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-700">Why this exists</div>
            <p className="mt-3 text-sm leading-7 text-ink-secondary">
              Replace scattered folders, disconnected previews, repeated setup errors, and the feeling that every job starts from scratch.
            </p>
          </div>
          <div className="rounded-[2rem] border border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(242,237,231,0.9))] p-6 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-700">Workflow</div>
            <div className="mt-4 grid gap-4">
              {workflowSteps.map((step, index) => (
                <div key={step.title} className="flex gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-raised text-sm font-semibold text-ink">
                    0{index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-ink">{step.title}</div>
                    <p className="mt-1 text-sm leading-7 text-ink-secondary">{step.copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[1560px] gap-5 px-4 pb-8 md:px-6 xl:grid-cols-4">
        {toolCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group overflow-hidden rounded-[1.9rem] border border-border/80 bg-[rgba(255,255,255,0.84)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
            >
              <div className={`h-1.5 rounded-full bg-gradient-to-r ${card.tone}`} />
              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface text-accent-700">
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-ink-muted transition group-hover:translate-x-1 group-hover:text-accent-700" />
              </div>
              <h2 className="mt-5 text-xl font-semibold text-ink">{card.title}</h2>
              <p className="mt-3 text-sm leading-7 text-ink-secondary">{card.copy}</p>
            </Link>
          );
        })}
      </section>

      <section className="mx-auto grid w-full max-w-[1560px] gap-6 px-4 py-10 md:px-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2.2rem] border border-border/80 bg-[rgba(255,255,255,0.88)] p-8 shadow-sm md:p-10">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-secondary">Targeted entry points</div>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight text-ink md:text-5xl">
            Start from the job in front of you.
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {audienceCards.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="rounded-[1.6rem] border border-border bg-surface px-5 py-5 transition hover:border-accent-300 hover:bg-accent-50/30"
              >
                <div className="text-lg font-semibold text-ink">{card.title}</div>
                <p className="mt-2 text-sm leading-7 text-ink-secondary">{card.copy}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-5">
          <div className="rounded-[2rem] border border-border/80 bg-[rgba(255,255,255,0.88)] p-6 shadow-sm">
            <div className="flex items-center gap-3 text-ink">
              <FolderHeart className="h-5 w-5 text-brand-500" />
              <h3 className="text-xl font-semibold">My Designs</h3>
            </div>
            <p className="mt-3 text-sm leading-7 text-ink-secondary">
              Reopen saved work, favorite the good sellers, archive old variants, rename quickly, and keep rhinestone and HTV work visible in one place.
            </p>
            <Link href="/designs" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent-600">
              Go to My Designs
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="rounded-[2rem] border border-border/80 bg-[rgba(255,255,255,0.88)] p-6 shadow-sm">
            <div className="flex items-center gap-3 text-ink">
              <Settings2 className="h-5 w-5 text-brand-500" />
              <h3 className="text-xl font-semibold">Production Settings</h3>
            </div>
            <p className="mt-3 text-sm leading-7 text-ink-secondary">
              Keep machine, material, flock, stone, and workflow defaults together so the tools can feel smarter and less repetitive over time.
            </p>
            <Link href="/settings" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent-600">
              Open settings
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
