/**
 * Google Analytics 4 and Google Tag Manager: loaded only when the owner has entered an id in the admin panel, and only for a
 * browser that has not asked not to be tracked (checked by the caller). Everything is passed in, so it can be tested without a page.
 *
 * Which service gets the events: with a GA4 id they go to GA4 through gtag (Tag Manager sees them in the dataLayer too, so do not
 * also add a GA4 tag in Tag Manager, or every visit is counted twice). With only a Tag Manager id they are pushed to the dataLayer
 * as `{ event: <name>, ... }` for the container's triggers.
 */

import { isGa4Id, isGtmId, type PublicTrackingConfig, type TrackEvent } from '@/src/lib/tracking/trackingConfig';

export interface ThirdPartyWindow {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
}

export interface ThirdPartyHost {
  win: ThirdPartyWindow;
  addScript: (src: string) => void;
  nowMs: number;
}

/** Sets up the dataLayer and loads the scripts for the ids that are valid. Returns which services were started. */
export function loadThirdParty(config: Pick<PublicTrackingConfig, 'ga4Id' | 'gtmId'>, host: ThirdPartyHost): { ga4: boolean; gtm: boolean } {
  const ga4 = isGa4Id(config.ga4Id);
  const gtm = isGtmId(config.gtmId);
  if (!ga4 && !gtm) return { ga4: false, gtm: false };
  const { win } = host;
  const layer = (win.dataLayer = win.dataLayer ?? []);

  if (gtm) {
    layer.push({ 'gtm.start': host.nowMs, event: 'gtm.js' });
    host.addScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(config.gtmId)}`);
  }
  if (ga4) {
    // gtag.js looks for `arguments` objects in the dataLayer, not arrays, so this must be a plain function.
    win.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      layer.push(arguments);
    };
    win.gtag('js', new Date(host.nowMs));
    // Page views are sent by us on every route change (the app never reloads the page).
    win.gtag('config', config.ga4Id, { send_page_view: false });
    host.addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.ga4Id)}`);
  }
  return { ga4, gtm };
}

/** Sends one event to the services that are on. */
export function mirrorEvent(started: { ga4: boolean; gtm: boolean }, win: ThirdPartyWindow, event: TrackEvent): void {
  const params: Record<string, unknown> = { ...event.props, page_path: event.path };
  if (event.label) params.label = event.label;
  if (started.ga4 && win.gtag) {
    win.gtag('event', event.name, params);
  } else if (started.gtm && win.dataLayer) {
    win.dataLayer.push({ ...params, event: event.name });
  }
}
