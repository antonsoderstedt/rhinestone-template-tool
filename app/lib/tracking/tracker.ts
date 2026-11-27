/**
 * Collects events and delivers them: to our own database (batched, in the background) and to Google Analytics / Tag Manager.
 * It does nothing until the settings have arrived, and nothing at all for a browser that asked not to be tracked.
 * Everything it needs from the page is passed in, so it can be tested.
 */

import { EVENT_LIMITS, sanitizeEvent, trackingBlocked, type EventValue, type PublicTrackingConfig, type TrackEvent } from '@/src/lib/tracking/trackingConfig';

export interface TrackerDeps {
  /** Sends a batch to the server. Failures are ignored: statistics are never worth bothering the person for. */
  send: (events: TrackEvent[]) => void;
  /** Sends one event to Google Analytics / Tag Manager (only called when one of them is on). */
  mirror: (event: TrackEvent) => void;
  /** Called once when the settings say a third-party service is wanted. */
  startThirdParty: (config: PublicTrackingConfig) => void;
  schedule: (fn: () => void, ms: number) => unknown;
  cancel: (handle: unknown) => void;
  path: () => string;
  session: string;
  nav: { doNotTrack?: string | null; globalPrivacyControl?: boolean };
}

const FLUSH_MS = 3000;
const MAX_WAITING = 50;
const MAX_QUEUED = 100;

export class Tracker {
  private state: 'unknown' | 'off' | 'on' = 'unknown';
  private config: PublicTrackingConfig | null = null;
  private waiting: TrackEvent[] = [];
  private queue: TrackEvent[] = [];
  private timer: unknown = null;

  constructor(private readonly deps: TrackerDeps) {}

  /** Records an event. Events that come before the settings are kept briefly and handled once they arrive. */
  track(name: string, props: Record<string, EventValue> = {}, label = '', path?: string): void {
    const event = sanitizeEvent({ name, path: path ?? this.deps.path(), label, props, session: this.deps.session });
    if (!event) return;
    if (this.state === 'unknown') {
      if (this.waiting.length < MAX_WAITING) this.waiting.push(event);
    } else if (this.state === 'on') {
      this.deliver(event);
    }
  }

  /** The settings arrived (`null`: this site has no tracking, or they could not be read). */
  configure(config: PublicTrackingConfig | null): void {
    const waiting = this.waiting;
    this.waiting = [];
    if (!config || trackingBlocked(config, this.deps.nav) || (!config.ownEvents && !config.ga4Id && !config.gtmId)) {
      this.state = 'off';
      return;
    }
    this.state = 'on';
    this.config = config;
    if (config.ga4Id || config.gtmId) this.deps.startThirdParty(config);
    for (const event of waiting) this.deliver(event);
  }

  private deliver(event: TrackEvent): void {
    const config = this.config;
    if (!config) return;
    if (config.ga4Id || config.gtmId) this.deps.mirror(event);
    if (!config.ownEvents) return;
    if (this.queue.length < MAX_QUEUED) this.queue.push(event);
    if (this.timer === null) this.timer = this.deps.schedule(() => this.flush(), FLUSH_MS);
  }

  /** Sends what is waiting now (also used when the page is hidden or closed). */
  flush(): void {
    if (this.timer !== null) {
      this.deps.cancel(this.timer);
      this.timer = null;
    }
    while (this.queue.length > 0) this.deps.send(this.queue.splice(0, EVENT_LIMITS.batch));
  }
}
