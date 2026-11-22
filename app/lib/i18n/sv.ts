/**
 * Swedish for the text in the app. The key is the English text exactly as it is written where it is used. `{name}` marks a
 * value that is filled in; it must be in the Swedish text too (a test checks this, and that every `t('…')` in the source has an
 * entry). The entries are in `sv.json`.
 */
import dictionary from './sv.json';

export const SV: Readonly<Record<string, string>> = dictionary;
