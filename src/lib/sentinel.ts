// "Standby Sentinella Connessioni": keeps the page awake and listening for incoming
// connection requests. Browser-only APIs (Notification, Screen Wake Lock, Document PiP)
// are injected so the logic can be tested; nothing here talks to any server other than the
// existing relay, through the keepAlive callback.

export type NotifyPermission = NotificationPermission | "unsupported";

type WakeLockLike = { release: () => Promise<void>; addEventListener?: (t: "release", cb: () => void) => void };
type NavLike = {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockLike> };
  serviceWorker?: {
    getRegistration?: () => Promise<
      { showNotification: (title: string, opts?: NotificationOptions) => Promise<void> } | undefined
    >;
  };
};
type NotificationCtor = {
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  new (title: string, opts?: NotificationOptions): unknown;
};
type DocLike = {
  visibilityState: DocumentVisibilityState;
  addEventListener: (t: "visibilitychange", cb: () => void) => void;
  removeEventListener: (t: "visibilitychange", cb: () => void) => void;
};

export type SentinelEnv = {
  nav?: NavLike | undefined;
  Notification?: NotificationCtor | undefined;
  doc?: DocLike | undefined;
};

export type SentinelStatus = {
  active: boolean;
  startedAt: number | null;
  notifications: NotifyPermission;
  wakeLock: "active" | "released" | "unsupported" | "denied";
  /** Incoming requests received since standby started. */
  incoming: number;
  lastBeatAt: number | null;
  lastBeatOk: boolean;
};

export const KEEP_ALIVE_MS = 20_000;

export const IDLE_STATUS: SentinelStatus = {
  active: false,
  startedAt: null,
  notifications: "default",
  wakeLock: "released",
  incoming: 0,
  lastBeatAt: null,
  lastBeatOk: false,
};

function defaultEnv(): SentinelEnv {
  if (typeof window === "undefined") return {};
  return {
    nav: navigator as unknown as NavLike,
    Notification: (globalThis as { Notification?: NotificationCtor }).Notification,
    doc: document,
  };
}

/** "hh:mm:ss" (or "mm:ss" under an hour) for the active listening time. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}

/** Handles that appear in `next` but were not in `prev` (new incoming requests). */
export function newArrivals(prev: readonly string[], next: readonly string[]): string[] {
  const seen = new Set(prev);
  return next.filter((h) => !seen.has(h));
}

export class Sentinel {
  private lock: WakeLockLike | null = null;
  private beat: ReturnType<typeof setInterval> | null = null;
  private onVisible: (() => void) | null = null;
  private status: SentinelStatus = { ...IDLE_STATUS };

  constructor(
    private keepAlive: () => boolean,
    private onChange: (s: SentinelStatus) => void,
    private env: SentinelEnv = defaultEnv(),
    private intervalMs = KEEP_ALIVE_MS,
  ) {}

  get current() {
    return this.status;
  }

  private set(p: Partial<SentinelStatus>) {
    this.status = { ...this.status, ...p };
    this.onChange(this.status);
  }

  /** Must be called from a user gesture (permission prompt and wake lock both require it). */
  async start() {
    if (this.status.active) return this.status;
    this.set({ ...IDLE_STATUS, active: true, startedAt: Date.now() });

    // 1. Notifications permission, so requests are signalled while the user looks elsewhere.
    const N = this.env.Notification;
    let notifications: NotifyPermission = "unsupported";
    if (N) {
      try {
        notifications = N.permission === "default" ? await N.requestPermission() : N.permission;
      } catch {
        notifications = N.permission;
      }
    }
    this.set({ notifications });

    // 2. Screen wake lock; the browser releases it when the tab is hidden, so re-acquire on return.
    await this.acquire();
    const doc = this.env.doc;
    if (doc) {
      this.onVisible = () => {
        if (this.status.active && doc.visibilityState === "visible" && !this.lock) void this.acquire();
        if (doc.visibilityState === "visible") this.heartbeat();
      };
      doc.addEventListener("visibilitychange", this.onVisible);
    }

    // 4. Regular keep-alive heartbeat on the relay WebSocket.
    this.heartbeat();
    this.beat = setInterval(() => this.heartbeat(), this.intervalMs);
    return this.status;
  }

  private async acquire() {
    const wl = this.env.nav?.wakeLock;
    if (!wl) return this.set({ wakeLock: "unsupported" });
    try {
      const lock = await wl.request("screen");
      if (!this.status.active) {
        await lock.release().catch(() => undefined);
        return;
      }
      this.lock = lock;
      lock.addEventListener?.("release", () => {
        if (this.lock === lock) this.lock = null;
        if (this.status.active) this.set({ wakeLock: "released" });
      });
      this.set({ wakeLock: "active" });
    } catch {
      this.set({ wakeLock: "denied" });
    }
  }

  heartbeat() {
    if (!this.status.active) return;
    let ok = false;
    try {
      ok = this.keepAlive();
    } catch {
      ok = false;
    }
    this.set({ lastBeatAt: Date.now(), lastBeatOk: ok });
  }

  /** Counts a new incoming request and shows a local notification when allowed. */
  async incoming(handle: string) {
    if (!this.status.active) return false;
    this.set({ incoming: this.status.incoming + 1 });
    return this.notify("Nuova richiesta di connessione", `@${handle} vuole connettersi con te su QuestionAR`, `req-${handle}`);
  }

  private async notify(title: string, body: string, tag: string) {
    const N = this.env.Notification;
    if (!N || N.permission !== "granted") return false;
    const opts: NotificationOptions = { body, tag, icon: "/icon-192.png", badge: "/favicon.png" };
    try {
      // Mobile browsers only allow notifications through the service worker.
      const reg = await this.env.nav?.serviceWorker?.getRegistration?.();
      if (reg) {
        await reg.showNotification(title, opts);
        return true;
      }
    } catch {
      /* fall back to a page notification */
    }
    try {
      new N(title, opts);
      return true;
    } catch {
      return false;
    }
  }

  /** 5. Manual stop at any time: releases the wake lock and stops the heartbeat. */
  async stop() {
    if (this.beat) clearInterval(this.beat);
    this.beat = null;
    if (this.onVisible && this.env.doc) this.env.doc.removeEventListener("visibilitychange", this.onVisible);
    this.onVisible = null;
    const lock = this.lock;
    this.lock = null;
    this.set({ ...IDLE_STATUS, notifications: this.status.notifications });
    await lock?.release().catch(() => undefined);
  }
}
