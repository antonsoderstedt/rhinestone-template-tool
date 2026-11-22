/**
 * Starting points on the home page: a real word in a real font that opens the studio with the design already made.
 * They are the things people cut most (a name, a number, a monogram), so nobody starts from a blank canvas.
 */

import { buildFontLaunchUrl } from './fontLaunch';

export interface StarterDesign {
  id: string;
  title: string;
  /** One short line of what it is for. */
  note: string;
  fontId: string;
  /** The words shown on the card and put in the studio. */
  text: string;
}

export const STARTER_DESIGNS: readonly StarterDesign[] = [
  { id: 'name', title: 'A name', note: 'Bold, easy to cut', fontId: 'archivo-black', text: 'YOUR\nNAME' },
  { id: 'jersey-number', title: 'Jersey number', note: 'Tall and narrow', fontId: 'anton-condensed', text: '23' },
  { id: 'team', title: 'Team name', note: 'Varsity style', fontId: 'black-ops-varsity', text: 'TIGERS' },
  { id: 'monogram', title: 'Monogram', note: 'Three initials', fontId: 'bitter-slab', text: 'ABC' },
  { id: 'bubble', title: 'Soft word', note: 'Round and friendly', fontId: 'lilita-bubble', text: 'Love' },
  { id: 'slim', title: 'Slim name', note: 'Clean and light', fontId: 'bebas-neue', text: 'MIA' },
];

export function starterLaunchUrl(starter: StarterDesign): string {
  return buildFontLaunchUrl('rhinestone', starter.fontId, starter.text);
}
