import Link from 'next/link';
import { Bebas_Neue, Sora } from 'next/font/google';
import { ArrowRight, FolderHeart, Gem, LibraryBig, Settings2, SwatchBook, Type } from 'lucide-react';

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

export default function Home() {
  return (
    <div className={`${sora.variable} bg-[radial-gradient(circle_at_top_left,rgba(255,107,61,0.20),transparent_30%),radial-gradient(circle_at_top_right,rgba(124,77,255,0.18),transparent_28%),linear-gradient(180deg,#faf8f5_0%,#f6f1e8_35%,#faf8f5_100%)]`}>
      <section className="mx-auto flex w-full max-w-[1500px] flex-col gap-10 px-4 py-10 md:px-6 md:py-16 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-4xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-500/15 bg-surface-raised/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-brand-600 shadow-sm">
            Rhinestone, HTV, assets, fonts, saved production flow
          </div>
          <h1 className={`${display.className} text-6xl leading-[0.92] tracking-[0.04em] text-ink md:text-8xl xl:text-[9rem]`}>
            Build faster. Sell sharper. Cut cleaner.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-ink-secondary md:text-xl">
            One workspace for rhinestone templates, HTV layouts, asset curation, font exploration, design archives, and production settings.
            Made for people who want the tool to feel premium, obvious, powerful, and worth opening every day.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/rhinestone"
              className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,var(--color-brand-500),var(--color-accent-500))] px-6 py-3 text-sm font-semibold text-ink-inverse shadow-xl shadow-brand-500/20 transition hover:translate-y-[-1px] hover:brightness-105"
            >
              Open Rhinestone Studio
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/htv"
              className="inline-flex items-center gap-2 rounded-2xl border border-border-strong bg-surface-raised/90 px-6 py-3 text-sm font-semibold text-ink transition hover:border-accent-300 hover:text-accent-600"
            >
              Explore HTV Studio
            </Link>
            <Link
              href="/library"
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface/80 px-6 py-3 text-sm font-medium text-ink-secondary transition hover:bg-surface-raised hover:text-ink"
            >
              Organize your library
            </Link>
          </div>
        </div>

        <div className="grid max-w-xl gap-4 md:grid-cols-2">
          <div className="rounded-[2rem] border border-border bg-surface-raised/90 p-6 shadow-lg shadow-sand-900/5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-600">What it replaces</div>
            <p className="mt-3 text-sm leading-7 text-ink-secondary">
              Folder chaos, disconnected font previews, repeated setup mistakes, and the friction of switching between “finding”, “testing”, and “producing”.
            </p>
          </div>
          <div className="rounded-[2rem] border border-border bg-surface-raised/90 p-6 shadow-lg shadow-sand-900/5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">Why it feels premium</div>
            <p className="mt-3 text-sm leading-7 text-ink-secondary">
              Faster entry points, richer previews, searchable systems, material defaults, saved context, and fewer expensive production guesses.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[1500px] gap-5 px-4 pb-8 md:px-6 xl:grid-cols-4">
        {toolCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group relative overflow-hidden rounded-[2rem] border border-border bg-surface-raised/90 p-6 shadow-lg shadow-sand-900/5 transition hover:translate-y-[-2px] hover:border-border-strong"
            >
              <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${card.tone}`} />
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-sunken text-accent-600">
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-ink-muted transition group-hover:translate-x-1 group-hover:text-accent-500" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-ink">{card.title}</h2>
              <p className="mt-3 text-sm leading-7 text-ink-secondary">{card.copy}</p>
            </Link>
          );
        })}
      </section>

      <section className="mx-auto grid w-full max-w-[1500px] gap-6 px-4 py-10 md:px-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2.5rem] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(255,255,255,0.94))] p-8 shadow-xl shadow-sand-900/5 md:p-10">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-secondary">Targeted entry points</div>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight text-ink md:text-5xl">
            Start from the job you have, not from a blank page.
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {audienceCards.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="rounded-[1.75rem] border border-border bg-surface px-5 py-5 transition hover:border-accent-300 hover:bg-accent-50/40"
              >
                <div className="text-lg font-semibold text-ink">{card.title}</div>
                <p className="mt-2 text-sm leading-7 text-ink-secondary">{card.copy}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-5">
          <div className="rounded-[2rem] border border-border bg-surface-raised/90 p-6 shadow-lg shadow-sand-900/5">
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

          <div className="rounded-[2rem] border border-border bg-surface-raised/90 p-6 shadow-lg shadow-sand-900/5">
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
