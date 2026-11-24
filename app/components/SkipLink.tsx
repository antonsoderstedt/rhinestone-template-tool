'use client';

/**
 * First focusable element on every page: lets keyboard and screen-reader users jump past the
 * top bar straight to the page content (or, in a studio, the editor). Invisible until focused.
 */
export default function SkipLink({ label }: { label: string }) {
  return (
    <a
      href="#main-content"
      onClick={(event) => {
        // A bare hash link scrolls but does not always move keyboard focus; do it explicitly.
        const target = document.getElementById('main-content');
        if (!target) return;
        event.preventDefault();
        target.focus({ preventScroll: false });
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-violet-900 focus:shadow-xl"
    >
      {label}
    </a>
  );
}
