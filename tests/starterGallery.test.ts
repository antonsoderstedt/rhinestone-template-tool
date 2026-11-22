import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import StarterGallery from '../app/components/StarterGallery';
import { STARTER_DESIGNS, starterLaunchUrl } from '../app/lib/starterDesigns';
import { hasAnythingToRecover } from '../app/lib/workspaceRecovery';
import { isKnownOutlineFontId } from '../src/lib/rhinestone-engine/index';

describe('starter designs', () => {
  it('each uses a real font and opens the Rhinestone studio with its words', () => {
    expect(new Set(STARTER_DESIGNS.map((s) => s.id)).size).toBe(STARTER_DESIGNS.length);
    for (const starter of STARTER_DESIGNS) {
      expect(isKnownOutlineFontId(starter.fontId), starter.id).toBe(true);
      const url = starterLaunchUrl(starter);
      expect(url.startsWith('/rhinestone?font=')).toBe(true);
      expect(decodeURIComponent(url)).toContain(starter.text);
    }
  });

  it('renders one link per starter', () => {
    const html = renderToStaticMarkup(createElement(StarterGallery));
    for (const starter of STARTER_DESIGNS) expect(html).toContain(starter.title);
    expect((html.match(/href="\/rhinestone\?font=/g) ?? []).length).toBe(STARTER_DESIGNS.length);
  });
});

describe('home page recovery card', () => {
  it('is only shown when there is a draft or saved work', () => {
    expect(hasAnythingToRecover({ totalSavedDesigns: 0, hasAutosave: false })).toBe(false);
    expect(hasAnythingToRecover({ totalSavedDesigns: 2, hasAutosave: false })).toBe(true);
    expect(hasAnythingToRecover({ totalSavedDesigns: 0, hasAutosave: true })).toBe(true);
  });
});
