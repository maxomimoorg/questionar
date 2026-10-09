// QuestionAR relay. Stores nothing but short-lived opaque (end-to-end encrypted)
// envelopes waiting for an offline recipient. No profiles, no answers, no history.
import { DurableObject } from "cloudflare:workers";

interface Env {
  HUB: DurableObjectNamespace<RelayHub>;
  ALLOWED_ORIGINS?: string;
}

const ROOM_RE = /^[0-9a-f]{24}$/;
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const MAX_PAYLOAD = 48 * 1024; // bytes
const MAX_WATCH = 500;
const MAX_PENDING_PER_ROOM = 50;
const DEFAULT_TTL = 24 * 3600; // seconds
const MAX_TTL = 72 * 3600;
const PRESENCE_TIMEOUT = 90_000; // ms without ping => offline
const SWEEP_EVERY = 60_000;
const SEEN_TTL = 24 * 3600 * 1000; // dedup memory for already-delivered ids

type Attachment = { room: string; watch: string[] };

type ClientMsg =
  | { t: "hello"; room: string; watch?: string[] }
  | { t: "watch"; rooms: string[] }
  | { t: "send"; id: string; to: string; payload: string; ttl?: number }
  | { t: "ack"; id: string };

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/health") return new Response("ok");
    if (url.pathname !== "/ws") return new Response("Not found", { status: 404 });
    if (req.headers.get("Upgrade") !== "websocket")
      return new Response("Expected WebSocket", { status: 426 });
    const allowed = (env.ALLOWED_ORIGINS ?? "*").split(",").map((s) => s.trim());
    const origin = req.headers.get("Origin") ?? "";
    if (!allowed.includes("*") && !allowed.includes(origin))
      return new Response("Origin not allowed", { status: 403 });
    // One hub keeps presence consistent; ample for the free-plan scale of this app.
    const stub = env.HUB.get(env.HUB.idFromName("global"));
    return stub.fetch(req);
  },
};

export class RelayHub extends DurableObject<Env> {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS pending (
      id TEXT PRIMARY KEY, to_room TEXT NOT NULL, from_room TEXT NOT NULL,
      payload TEXT NOT NULL, expires INTEGER NOT NULL)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS pending_to ON pending(to_room)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS seen (id TEXT PRIMARY KEY, expires INTEGER NOT NULL)`);
    // Pings are answered without waking the object (keeps usage inside the free quota).
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
  }

  async fetch(_req: Request): Promise<Response> {
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    await this.ensureAlarm();
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  private att(ws: WebSocket): Attachment | null {
    return (ws.deserializeAttachment() as Attachment | null) ?? null;
  }

  private isOnline(room: string) {
    return this.roomSockets(room).length > 0;
  }

  private send(ws: WebSocket, msg: unknown) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* closed */
    }
  }

  private broadcastPresence(room: string, online: boolean) {
    for (const ws of this.ctx.getWebSockets()) {
      const a = this.att(ws);
      if (a?.watch.includes(room)) this.send(ws, { t: "presence", room, online });
    }
  }

  private cleanRooms(list: unknown): string[] {
    if (!Array.isArray(list)) return [];
    return [...new Set(list.filter((r): r is string => typeof r === "string" && ROOM_RE.test(r)))].slice(0, MAX_WATCH);
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== "string" || raw.length > MAX_PAYLOAD + 1024) return ws.close(1009, "too big");
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw) as ClientMsg;
    } catch {
      return;
    }
    const now = Date.now();
    const a = this.att(ws);

    if (msg.t === "hello") {
      if (!ROOM_RE.test(msg.room)) return ws.close(4000, "bad room");
      const watch = this.cleanRooms(msg.watch);
      ws.serializeAttachment({ room: msg.room, watch } satisfies Attachment);
      const wasOnline = this.roomSockets(msg.room).length > 1;
      if (!wasOnline) this.broadcastPresence(msg.room, true);
      for (const r of watch) this.send(ws, { t: "presence", room: r, online: this.roomSockets(r).length > 0 });
      // Flush pending envelopes for this room.
      const rows = this.sql
        .exec("SELECT id, from_room, payload FROM pending WHERE to_room = ? AND expires > ?", msg.room, now)
        .toArray();
      for (const r of rows) this.send(ws, { t: "msg", id: r.id, from: r.from_room, payload: r.payload });
      this.send(ws, { t: "ready" });
      return;
    }
    if (!a) return ws.close(4001, "hello first");

    if (msg.t === "watch") {
      const watch = this.cleanRooms([...a.watch, ...this.cleanRooms(msg.rooms)]);
      ws.serializeAttachment({ ...a, watch });
      for (const r of this.cleanRooms(msg.rooms))
        this.send(ws, { t: "presence", room: r, online: this.roomSockets(r).length > 0 });
      return;
    }

    if (msg.t === "send") {
      if (!ID_RE.test(msg.id) || !ROOM_RE.test(msg.to) || typeof msg.payload !== "string")
        return this.send(ws, { t: "error", id: msg.id, code: "invalid" });
      if (msg.payload.length > MAX_PAYLOAD) return this.send(ws, { t: "error", id: msg.id, code: "too_big" });
      // Deduplication: an id already queued or already delivered is acknowledged, not re-sent.
      const dupe =
        this.sql.exec("SELECT 1 FROM pending WHERE id = ?", msg.id).toArray().length > 0 ||
        this.sql.exec("SELECT 1 FROM seen WHERE id = ? AND expires > ?", msg.id, now).toArray().length > 0;
      if (dupe) return this.send(ws, { t: "stored", id: msg.id, dupe: true });
      const count = Number(
        this.sql.exec("SELECT COUNT(*) AS n FROM pending WHERE to_room = ?", msg.to).one().n,
      );
      if (count >= MAX_PENDING_PER_ROOM) return this.send(ws, { t: "error", id: msg.id, code: "inbox_full" });
      const ttl = Math.min(Math.max(Number(msg.ttl) || DEFAULT_TTL, 60), MAX_TTL);
      this.sql.exec(
        "INSERT INTO pending (id, to_room, from_room, payload, expires) VALUES (?, ?, ?, ?, ?)",
        msg.id, msg.to, a.room, msg.payload, now + ttl * 1000,
      );
      for (const target of this.roomSockets(msg.to))
        this.send(target, { t: "msg", id: msg.id, from: a.room, payload: msg.payload });
      this.send(ws, { t: "stored", id: msg.id });
      return;
    }

    if (msg.t === "ack") {
      if (!ID_RE.test(msg.id)) return;
      const row = this.sql
        .exec("SELECT from_room FROM pending WHERE id = ? AND to_room = ?", msg.id, a.room)
        .toArray()[0];
      if (!row) return;
      this.sql.exec("DELETE FROM pending WHERE id = ?", msg.id);
      this.sql.exec("INSERT OR REPLACE INTO seen (id, expires) VALUES (?, ?)", msg.id, now + SEEN_TTL);
      for (const s of this.roomSockets(String(row.from_room))) this.send(s, { t: "delivered", id: msg.id });
    }
  }

  private roomSockets(room: string) {
    return this.ctx.getWebSockets().filter((ws) => this.att(ws)?.room === room);
  }

  async webSocketClose(ws: WebSocket) {
    this.handleGone(ws);
  }

  async webSocketError(ws: WebSocket) {
    this.handleGone(ws);
  }

  private handleGone(ws: WebSocket) {
    const a = this.att(ws);
    ws.serializeAttachment(null);
    if (a && this.roomSockets(a.room).filter((s) => s !== ws).length === 0)
      this.broadcastPresence(a.room, false);
  }

  private async ensureAlarm() {
    if ((await this.ctx.storage.getAlarm()) == null)
      await this.ctx.storage.setAlarm(Date.now() + SWEEP_EVERY);
  }

  async alarm() {
    const now = Date.now();
    // Presence expiry: sockets that stopped pinging are closed and reported offline.
    for (const ws of this.ctx.getWebSockets()) {
      const last = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? 0;
      const a = this.att(ws);
      if (a && last && now - last > PRESENCE_TIMEOUT) {
        this.handleGone(ws);
        try { ws.close(4008, "presence expired"); } catch { /* ignore */ }
      }
    }
    // Pending requests expire automatically.
    this.sql.exec("DELETE FROM pending WHERE expires <= ?", now);
    this.sql.exec("DELETE FROM seen WHERE expires <= ?", now);
    const empty =
      this.ctx.getWebSockets().length === 0 &&
      Number(this.sql.exec("SELECT COUNT(*) AS n FROM pending").one().n) === 0;
    if (!empty) await this.ctx.storage.setAlarm(now + SWEEP_EVERY);
  }
}
