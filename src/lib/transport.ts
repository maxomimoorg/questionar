// Presence + rendezvous transports. Both only carry opaque, already-encrypted strings.
//  - RelayTransport: the Cloudflare relay (relay/), configured with VITE_RELAY_URL.
//  - MqttTransport: public MQTT brokers, used only if the user opts in as a fallback.

export type TransportEvents = {
  onWire: (raw: string) => void;
  onPresence: (room: string, online: boolean) => void;
  onStatus: (connected: boolean) => void;
  /** The transport cannot be used (not configured, quota reached, repeated failures). */
  onUnavailable: (reason: string) => void;
};

export interface Transport {
  readonly kind: "relay" | "mqtt";
  start(myRoom: string, watch: string[]): void;
  watch(room: string): void;
  send(toRoom: string, id: string, raw: string, ttlSec: number): Promise<boolean>;
  isConnected(): boolean;
  stop(): void;
}

export const RELAY_URL: string = (import.meta.env['VITE_RELAY_URL'] as string | undefined)?.trim() ?? "";

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
  private waiters = new Map<string, (ok: boolean) => void>();

  constructor(private url: string, private ev: TransportEvents) {}

  start(myRoom: string, watch: string[]) {
    this.room = myRoom;
    watch.forEach((r) => this.watched.add(r));
    this.stopped = false;
    this.open();
  }

  private open() {
    if (this.stopped) return;
    const base = this.url.replace(/^http/, "ws").replace(/\/$/, "");
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${base}/ws`);
    } catch {
      return this.fail("invalid relay url");
    }
    this.ws = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ t: "hello", room: this.room, watch: [...this.watched] }));
      this.ping = setInterval(() => ws.readyState === 1 && ws.send('{"t":"ping"}'), 30_000);
      ws.send('{"t":"ping"}');
    };
    ws.onmessage = (e) => {
      let m: { t: string; room?: unknown; online?: unknown; payload?: unknown; id?: unknown };
      try {
        m = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (m.t === "ready") {
        this.ready = true;
        this.failures = 0;
        this.ev.onStatus(true);
      } else if (m.t === "presence") this.ev.onPresence(String(m.room), Boolean(m.online));
      else if (m.t === "msg") {
        this.ev.onWire(String(m.payload));
        // Application-level receipt: the relay deletes the envelope only after this.
        ws.send(JSON.stringify({ t: "ack", id: m.id }));
      } else if (m.t === "stored") this.resolve(String(m.id), true);
      else if (m.t === "error") this.resolve(String(m.id), false);
    };
    ws.onclose = (e) => {
      if (this.ping) clearInterval(this.ping);
      this.ready = false;
      this.ev.onStatus(false);
      for (const id of [...this.waiters.keys()]) this.resolve(id, false);
      if (this.stopped) return;
      // Cloudflare answers with errors/closes once the free daily quota is exhausted.
      if (e.code === 1013 || e.code === 4029) return this.fail("quota");
      this.fail("closed");
    };
  }

  private fail(reason: string) {
    this.failures++;
    if (this.failures >= 4) {
      this.stopped = true;
      this.ev.onUnavailable(reason === "closed" ? "unreachable" : reason);
      return;
    }
    this.retry = setTimeout(() => this.open(), Math.min(30_000, 2000 * 2 ** this.failures));
  }

  private resolve(id: string, ok: boolean) {
    const w = this.waiters.get(id);
    if (w) {
      this.waiters.delete(id);
      w(ok);
    }
  }

  watch(room: string) {
    if (this.watched.has(room)) return;
    this.watched.add(room);
    if (this.ready) this.ws?.send(JSON.stringify({ t: "watch", rooms: [room] }));
  }

  send(toRoom: string, id: string, raw: string, ttlSec: number) {
    if (!this.ready || !this.ws) return Promise.resolve(false);
    return new Promise<boolean>((res) => {
      this.waiters.set(id, res);
      setTimeout(() => this.resolve(id, false), 8000);
      this.ws!.send(JSON.stringify({ t: "send", id, to: toRoom, payload: raw, ttl: ttlSec }));
    });
  }

  isConnected() {
    return this.ready;
  }

  stop() {
    this.stopped = true;
    if (this.retry) clearTimeout(this.retry);
    if (this.ping) clearInterval(this.ping);
    this.ws?.close(1000);
    this.ws = null;
  }
}

const BROKERS = [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://test.mosquitto.org:8081/mqtt",
  "wss://broker.hivemq.com:8884/mqtt",
];
const ROOT = "questionar/v2";

/** Opt-in fallback: public brokers (third parties). Payloads stay end-to-end encrypted. */
export class MqttTransport implements Transport {
  readonly kind = "mqtt" as const;
  private client: import("mqtt").MqttClient | null = null;
  private brokerIndex = 0;
  private room = "";
  private watched = new Set<string>();

  constructor(private ev: TransportEvents) {}

  start(myRoom: string, watch: string[]) {
    this.room = myRoom;
    watch.forEach((r) => this.watched.add(r));
    void this.connect();
  }

  private async connect() {
    const { default: mqtt } = await import("mqtt");
    const url = BROKERS[this.brokerIndex % BROKERS.length]!;
    const client = mqtt.connect(url, {
      clientId: `qar_${Math.random().toString(16).slice(2)}`,
      reconnectPeriod: 4000,
      connectTimeout: 6000,
      keepalive: 30,
      clean: true,
      will: { topic: `${ROOT}/presence/${this.room}`, payload: "0", qos: 0, retain: true },
    });
    this.client = client;
    client.on("connect", () => {
      this.ev.onStatus(true);
      client.subscribe([`${ROOT}/inbox/${this.room}`, `${ROOT}/presence/+`]);
      client.publish(`${ROOT}/presence/${this.room}`, "1", { retain: true });
    });
    client.on("message", (topic, payload) => {
      if (topic.startsWith(`${ROOT}/presence/`)) {
        const room = topic.split("/").pop()!;
        if (this.watched.has(room)) this.ev.onPresence(room, payload.toString() === "1");
        return;
      }
      this.ev.onWire(payload.toString());
    });
    client.on("error", () => {
      this.ev.onStatus(false);
      this.brokerIndex++;
      client.end(true, () => void this.connect());
    });
    client.on("close", () => this.ev.onStatus(false));
  }

  watch(room: string) {
    this.watched.add(room);
  }

  async send(toRoom: string, _id: string, raw: string) {
    if (!this.client?.connected) return false;
    this.client.publish(`${ROOT}/inbox/${toRoom}`, raw);
    return true;
  }

  isConnected() {
    return Boolean(this.client?.connected);
  }

  stop() {
    this.client?.publish(`${ROOT}/presence/${this.room}`, "0", { retain: true });
    this.client?.end(true);
    this.client = null;
  }
}
