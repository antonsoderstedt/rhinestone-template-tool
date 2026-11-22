'use client';

import { LANGUAGES, setLanguage, useLanguage, useT } from '../lib/i18n';

/** English / Svenska. The choice is kept in this browser. */
export default function LanguageSwitch({ className = '' }: { className?: string }) {
  const language = useLanguage();
  const t = useT();
  return (
    <div role="group" aria-label={t('Language')} className={`inline-flex overflow-hidden rounded-md border border-white/10 text-xs font-medium ${className}`}>
      {LANGUAGES.map((option) => (
        <button
          key={option.id}
          type="button"
          lang={option.id}
          aria-pressed={language === option.id}
          onClick={() => setLanguage(option.id)}
          className={`px-2.5 py-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
            language === option.id ? 'bg-violet-500/35 text-white' : 'bg-white/5 text-zinc-400 hover:text-zinc-100'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
