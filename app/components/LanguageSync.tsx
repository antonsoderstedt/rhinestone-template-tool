'use client';

import { useEffect } from 'react';
import { useLanguage } from '../lib/i18n';

/** Keeps `<html lang>` in step with the chosen language (screen readers and hyphenation use it). */
export default function LanguageSync() {
  const language = useLanguage();
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return null;
}
