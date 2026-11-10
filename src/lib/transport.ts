// Presence + rendezvous transport: the Cloudflare relay (relay/), configured with VITE_RELAY_URL.
import { recordEvent } from "./diagnostics/buffer";
// It only carries opaque strings; profile data is end-to-end encrypted before it leaves the device.

/** Outcome of handling one inbound message; decides whether the relay may drop it. */
export type DeliveryResult =
  | "ok" // handled
  | "duplicate" // already handled earlier: confirm, do not repeat actions
  | "invalid" // permanently unusable (bad format, wrong key, undecryptable)
  | "retry"; // transient failure: leave it queued so the relay redelivers it

export type TransportEvents = {
  onWire: (raw: string) => Promise<DeliveryResult>;
  onPresence: (room: string, online: boolean) => void;
  onStatus: (connected: boolean) => void;
  /** The transport cannot be used (not configured, quota reached, repeated failures). */
  onUnavailable: (reason: string) => void;
};

export interface Transport {
  readonly kind: "relay";
  start(myRoom: string, watch: string[]): void;
  watch(room: string): void;
  send(toRoom: string, id: string, raw: string, ttlSec: number): Promise<boolean>;
  isConnected(): boolean;
  stop(): void;
}

export const RELAY_URL: string =
  (import.meta.env["VITE_RELAY_URL"] as string | undefined)?.trim() ?? "";

/** Only ws(s)/http(s) URLs are accepted; anything else counts as "not configured". */
export function relayWsUrl(url: string): string | null {
  const u = url.trim();
  if (!/^(https?|wss?):\/\/[^\s/]+/i.test(u)) return null;
  return `${u.replace(/^http/i, "ws").replace(/\/+$/, "")}/ws`;
}

type RelayOptions = {
  WebSocketImpl?: typeof WebSocket;
  connectTimeoutMs?: number;
  sendTimeoutMs?: number;
  maxFailures?: number;
};

type Waiter = { resolve: (ok: boolean) => void; timer: ReturnType<typeof setTimeout> };

export class RelayTransport implements Transport {
  readonly kind = "relay" as const;
  private ws: WebSocket | null = null;
  private room = "";
  private watched = new Set<string>();
  private failures = 0;
  private stopped = false;
  private ready = false;
  private ping: ReturnType<typeof setInterval> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private waiters = new Map<string, Waiter>();
  private WS: typeof WebSocket;
  private connectTimeoutMs: number;
  private sendTimeoutMs: number;
  private maxFailures: number;

  constructor(
    private url: string,
    private ev: TransportEvents,
    opts: RelayOptions = {},
  ) {
    this.WS = opts.WebSocketImpl ?? globalThis.WebSocket;
    this.connectTimeoutMs = opts.connectTimeoutMs ?? 10_000;
    this.sendTimeoutMs = opts.sendTimeoutMs ?? 8000;
    this.maxFailures = opts.maxFailures ?? 4;
  }

  start(myRoom: string, watch: string[]) {
    this.room = myRoom;
    watch.forEach((r) => this.watched.add(r));
    this.stopped = false;
    this.failures = 0;
    if (!relayWsUrl(this.url)) {
      this.stopped = true;
      recordEvent("relay.unavailable", { reason: "not_configured" });
      this.ev.onUnavailable("not_configured");
      return;
    }
    this.open();
  }

  private raw(ws: WebSocket, data: unknown): boolean {
    if (ws.readyState !== 1) return false;
    try {
      ws.send(typeof data === "string" ? data : JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  private clearTimers() {
    if (this.ping) clearInterval(this.ping);
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.ping = null;
    this.connectTimer = null;
  }

  private open() {
    if (this.stopped) return;
    const target = relayWsUrl(this.url)!;
    let ws: WebSocket;
    try {
      ws = new this.WS(target);
    } catch {
      return this.fail("invalid relay url");
    }
    this.ws = ws;
    recordEvent("relay.connecting", { attempt: this.failures + 1 });
    // A relay that accepts the socket but never says "ready" is treated as unreachable.
    this.connectTimer = setTimeout(() => {
      if (!this.ready && this.ws === ws) {
        try {
          ws.close(4000, "timeout");
        } catch {
          /* ignore */
        }
      }
    }, this.connectTimeoutMs);
    ws.onopen = () => {
      this.raw(ws, { t: "hello", room: this.room, watch: [...this.watched] });
      this.ping = setInterval(() => this.raw(ws, '{"t":"ping"}'), 30_000);
    };
    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      let m: { t: string; room?: unknown; online?: unknown; payload?: unknown; id?: unknown };
      try {
        m = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (m.t === "ready") {
        this.ready = true;
        this.failures = 0;
        if (this.connectTimer) clearTimeout(this.connectTimer);
        this.connectTimer = null;
        recordEvent("relay.ready");
        this.ev.onStatus(true);
      } else if (m.t === "presence") this.ev.onPresence(String(m.room), Boolean(m.online));
      else if (m.t === "msg" && typeof m.id === "string") this.receive(ws, m.id, String(m.payload));
      else if (m.t === "stored") this.resolve(String(m.id), true);
      else if (m.t === "error") this.resolve(String(m.id), false);
    };
    ws.onerror = () => {
      /* onclose follows */
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.clearTimers();
      const wasReady = this.ready;
      this.ready = false;
      recordEvent("relay.closed", { code: e.code, was_ready: wasReady });
      this.ev.onStatus(false);
      this.failAllWaiters();
      if (this.stopped) return;
      // Cloudflare answers with errors/closes once the free daily quota is exhausted.
      if (e.code === 1013 || e.code === 4029) return this.fail("quota");
      if (wasReady) this.failures = 0; // a working link that dropped: retry quickly
      this.fail("closed");
    };
  }

  /** The relay deletes an envelope only after the ack, so we ack only once it is handled. */
  private receive(ws: WebSocket, id: string, payload: string) {
    let result: Promise<DeliveryResult>;
    try {
      result = this.ev.onWire(payload);
    } catch {
      return; // not acked: redelivered at the next connection
    }
    void result
      .then((r) => {
        if (r === "retry") return;
        if (r === "invalid") console.warn(`[relay] message ${id} rejected as invalid`);
        this.raw(ws, r === "invalid" ? { t: "ack", id, rejected: true } : { t: "ack", id });
      })
      .catch(() => {
        /* not acked: redelivered at the next connection */
      });
  }

  private fail(reason: string) {
    this.failures++;
    if (this.failures >= this.maxFailures) {
      this.stopped = true;
      recordEvent("relay.unavailable", {
        reason: reason === "closed" ? "unreachable" : reason.replace(/\s+/g, "_"),
      });
      this.ev.onUnavailable(reason === "closed" ? "unreachable" : reason);
      return;
    }
    const delay = Math.min(30_000, 1000 * 2 ** this.failures);
    recordEvent("relay.retry_scheduled", { attempt: this.failures, delay_ms: delay });
    this.retry = setTimeout(() => this.open(), delay);
  }

  private resolve(id: string, ok: boolean) {
    const w = this.waiters.get(id);
    if (!w) return;
    this.waiters.delete(id);
    clearTimeout(w.timer);
    w.resolve(ok);
  }

  private failAllWaiters() {
    for (const id of [...this.waiters.keys()]) this.resolve(id, false);
  }

  watch(room: string) {
    if (this.watched.has(room)) return;
    this.watched.add(room);
    if (this.ready && this.ws) this.raw(this.ws, { t: "watch", rooms: [room] });
  }

  send(toRoom: string, id: string, raw: string, ttlSec: number) {
    const ws = this.ws;
    if (!this.ready || !ws) return Promise.resolve(false);
    // Same id already in flight: share the outcome instead of leaking a second waiter.
    const prev = this.waiters.get(id);
    if (prev) this.resolve(id, false);
    return new Promise<boolean>((res) => {
      const timer = setTimeout(() => this.resolve(id, false), this.sendTimeoutMs);
      this.waiters.set(id, { resolve: res, timer });
      if (!this.raw(ws, { t: "send", id, to: toRoom, payload: raw, ttl: ttlSec }))
        this.resolve(id, false);
    });
  }

  isConnected() {
    return this.ready;
  }

  pendingSends() {
    return this.waiters.size;
  }

  stop() {
    this.stopped = true;
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    this.clearTimers();
    const ws = this.ws;
    this.ws = null;
    this.ready = false;
    this.failAllWaiters();
    try {
      ws?.close(1000);
    } catch {
      /* ignore */
    }
  }
}
