// Presence and rendezvous ride on the Cloudflare relay only. Profile data is always end-to-end encrypted with the identity keys before it
// leaves the device; once both sides are online a direct WebRTC channel is attempted and the
// relay stays as fallback.

import { E2E, keyFingerprint, publicOnly, type Sealed } from "./e2e";
import type { KeyPairJwk } from "./keys";
import { recordEvent } from "./diagnostics/buffer";
import {
  RELAY_URL,
  RelayTransport,
  relayWsUrl,
  type DeliveryResult,
  type Transport,
  type TransportEvents,
} from "./transport";
import type { ProfileSnapshot } from "./types";

export type Envelope =
  /** First contact: travels in clear, so it carries nothing but the sender handle. */
  | { type: "request"; from: string }
  | { type: "keyx"; from: string }
  | { type: "preview"; from: string; name: string; snapshot: ProfileSnapshot }
  | { type: "accept"; from: string; name: string; snapshot: ProfileSnapshot }
  | { type: "reject"; from: string }
  | { type: "cancel"; from: string }
  | { type: "profile"; from: string; name: string; snapshot: ProfileSnapshot }
  | { type: "offer"; from: string; sdp: string; nonce?: string }
  | { type: "answer"; from: string; sdp: string; nonce?: string };

/** Types that may travel unencrypted: they contain no profile data. */
export const PLAIN_TYPES = new Set<Envelope["type"]>(["request", "keyx", "reject", "cancel"]);

export type Wire = {
  v: 2;
  id: string;
  from: string;
  /** Recipient handle; bound into the encryption so a message cannot be replayed to someone else. */
  to?: string;
  pub: JsonWebKey;
  msg?: Envelope;
  enc?: Sealed;
};

export type NetMode = "relay" | "offline";
/** Why the network is not (fully) available, for a clear message in the UI. */
export type NetIssue = "not_configured" | "unreachable" | "quota" | null;

const ICE: RTCIceServer[] = [{ urls: "stun:stun.cloudflare.com:3478" }];
const TTL: Partial<Record<Envelope["type"], number>> = {
  request: 72 * 3600,
  keyx: 72 * 3600,
  preview: 72 * 3600,
  accept: 72 * 3600,
  offer: 120,
  answer: 120,
};
const SEEN_MS = 24 * 3600_000;
const SEEN_MAX = 5000;

/** Stable room id for a handle (never exposes the handle itself). */
export async function roomId(handle: string): Promise<string> {
  const bytes = new TextEncoder().encode(`questionar:${handle}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const newId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");

export type MessageMeta = { pub: JsonWebKey; encrypted: boolean };

export type P2PHandlers = {
  /** May be async; a throw leaves a relay message queued for redelivery. */
  onMessage: (msg: Envelope, meta: MessageMeta) => void | Promise<void>;
  /** Called only on real changes (idempotent), and again after every reconnection. */
  onPresence: (handle: string, online: boolean) => void;
  onStatus: (connected: boolean, mode: NetMode, issue: NetIssue) => void;
  /** Pinned key for a handle (contact, request or first-seen cache). */
  getPeerKey: (handle: string) => JsonWebKey | undefined;
  /** A key seen for the first time: remembered as NOT verified. */
  rememberKey: (handle: string, key: JsonWebKey) => void;
  onKeyMismatch: (handle: string) => void;
  onUndecryptable: (handle: string) => void;
  /** Direct tunnel state: true only once the DataChannel is open. */
  onTunnel?: (handle: string, open: boolean) => void;
};

export type P2POptions = {
  relayUrl?: string;
  /** Tests inject an in-memory transport. */
  transportFactory?: (mode: "relay", ev: TransportEvents) => Transport;
  iceTimeoutMs?: number;
  tunnelTimeoutMs?: number;
  relayRetryMs?: number;
};

type Tunnel = {
  pc: RTCPeerConnection;
  nonce: string;
  role: "offer" | "answer";
  timer: ReturnType<typeof setTimeout>;
  channel: RTCDataChannel | null;
};

export class P2P {
  private transport: Transport | null = null;
  private mode: NetMode = "offline";
  private issue: NetIssue = null;
  private myRoom = "";
  private peerRooms = new Map<string, string>(); // room -> handle
  private presence = new Map<string, boolean>();
  private tunnels = new Map<string, Tunnel>();
  private seen = new Map<string, number>();
  private inflight = new Map<string, Promise<DeliveryResult>>();
  private relayRetry: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private e2e: E2E;
  private pub: JsonWebKey;
  private relayUrl: string;

  constructor(
    private handle: string,
    keys: KeyPairJwk,
    private handlers: P2PHandlers,
    private opts: P2POptions,
  ) {
    this.e2e = new E2E(keys.privateKey);
    this.pub = publicOnly(keys.publicKey);
    this.relayUrl = opts.relayUrl ?? RELAY_URL;
  }

  getMode() {
    return this.mode;
  }

  getIssue() {
    return this.issue;
  }

  isConnected() {
    return Boolean(this.transport?.isConnected());
  }

  isDirect(handle: string) {
    return this.tunnels.get(handle)?.channel?.readyState === "open";
  }

  /** Idempotent: starts the network once and (re)watches every given handle. */
  async start(peerHandles: string[]) {
    this.stopped = false;
    this.myRoom = await roomId(this.handle);
    for (const h of peerHandles) await this.track(h);
    if (this.transport) return;
    this.chooseNetwork();
  }

  /** After going back online / visible: retries the relay if it had given up. */
  reconnect() {
    if (this.stopped || !this.myRoom) return;
    if (this.transport?.isConnected()) return;
    if (this.mode === "relay" && this.transport) return; // still retrying by itself
    this.chooseNetwork();
  }

  private chooseNetwork() {
    if (relayWsUrl(this.relayUrl)) {
      this.issue = null;
      this.use("relay");
    } else {
      this.issue = "not_configured";
      this.use("offline");
    }
  }

  private use(mode: NetMode) {
    this.transport?.stop();
    this.transport = null;
    this.mode = mode;
    this.resetPresence();
    const ev: TransportEvents = {
      onWire: (raw) => this.deliver(raw),
      onPresence: (room, online) => {
        const h = this.peerRooms.get(room);
        if (h) this.setPresence(h, online);
      },
      onStatus: (c) => {
        if (!c) this.resetPresence();
        else if (mode === "relay") this.issue = null;
        this.handlers.onStatus(c, this.mode, this.issue);
      },
      onUnavailable: (reason) => {
        if (this.mode !== mode) return;
        this.issue =
          reason === "quota"
            ? "quota"
            : reason === "not_configured"
              ? "not_configured"
              : "unreachable";
        this.use("offline");
        if (this.issue !== "not_configured") this.scheduleRelayRetry();
      },
    };
    const make =
      this.opts.transportFactory ??
      ((_m: "relay", e: TransportEvents) => new RelayTransport(this.relayUrl, e));
    if (mode === "relay") this.transport = make(mode, ev);
    this.handlers.onStatus(false, mode, this.issue);
    this.transport?.start(this.myRoom, [...this.peerRooms.keys()]);
  }

  private scheduleRelayRetry() {
    if (this.relayRetry) clearTimeout(this.relayRetry);
    this.relayRetry = setTimeout(() => {
      this.relayRetry = null;
      if (!this.stopped && this.mode !== "relay") this.chooseNetwork();
    }, this.opts.relayRetryMs ?? 60_000);
  }

  private resetPresence() {
    for (const [h, on] of this.presence) {
      if (on) this.handlers.onPresence(h, false);
      this.closeTunnel(h);
    }
    this.presence.clear();
  }

  private setPresence(handle: string, online: boolean) {
    if (this.presence.get(handle) === online) return; // repeated notification: no-op
    this.presence.set(handle, online);
    if (!online) this.closeTunnel(handle);
    this.handlers.onPresence(handle, online);
  }

  isOnline(handle: string) {
    return this.presence.get(handle) === true;
  }

  private markSeen(id: string) {
    const now = Date.now();
    if (this.seen.size > SEEN_MAX)
      for (const [k, t] of this.seen)
        if (now - t > SEEN_MS || this.seen.size > SEEN_MAX) this.seen.delete(k);
    this.seen.set(id, now);
  }

  /** Decodes, verifies and handles one wire message; the result drives the relay ack. */
  deliver(raw: string): Promise<DeliveryResult> {
    let wire: Wire;
    try {
      wire = JSON.parse(raw) as Wire;
    } catch {
      return Promise.resolve("invalid");
    }
    if (
      !wire ||
      wire.v !== 2 ||
      typeof wire.id !== "string" ||
      typeof wire.from !== "string" ||
      !wire.pub?.x ||
      !wire.pub?.y ||
      wire.from === this.handle ||
      (wire.to !== undefined && wire.to !== this.handle)
    )
      return Promise.resolve("invalid");
    const seenAt = this.seen.get(wire.id);
    if (seenAt && Date.now() - seenAt < SEEN_MS) return Promise.resolve("duplicate");
    const running = this.inflight.get(wire.id);
    if (running) return running.then((r) => (r === "ok" ? "duplicate" : r));
    const p = this.process(wire)
      .catch((): DeliveryResult => "retry")
      .then((r) => {
        this.inflight.delete(wire.id);
        if (r === "ok" || r === "invalid") this.markSeen(wire.id);
        return r;
      });
    this.inflight.set(wire.id, p);
    return p;
  }

  private async process(wire: Wire): Promise<DeliveryResult> {
    const known = this.handlers.getPeerKey(wire.from);
    if (known && keyFingerprint(known) !== keyFingerprint(wire.pub)) {
      this.handlers.onKeyMismatch(wire.from);
      return "invalid";
    }

    let msg: Envelope;
    let encrypted = false;
    if (wire.enc) {
      const aad = wire.to ? `${wire.id}|${wire.from}|${wire.to}` : `${wire.id}|${wire.from}`;
      try {
        msg = JSON.parse(await this.e2e.open(wire.pub, wire.enc, aad)) as Envelope;
        encrypted = true;
      } catch {
        this.handlers.onUndecryptable(wire.from);
        return "invalid";
      }
    } else if (wire.msg && PLAIN_TYPES.has(wire.msg.type)) {
      msg = wire.msg;
    } else return "invalid";
    if (!msg || typeof msg !== "object" || msg.from !== wire.from) return "invalid";
    if (!encrypted && !PLAIN_TYPES.has(msg.type)) return "invalid";

    if (!known) this.handlers.rememberKey(wire.from, publicOnly(wire.pub));

    if (msg.type === "offer") await this.answerOffer(msg);
    else if (msg.type === "answer") await this.acceptAnswer(msg);
    else await this.handlers.onMessage(msg, { pub: publicOnly(wire.pub), encrypted });
    return "ok";
  }

  async track(handle: string) {
    const room = await roomId(handle);
    this.peerRooms.set(room, handle);
    this.transport?.watch(room);
  }

  private async encode(handle: string, msg: Envelope): Promise<{ id: string; raw: string } | null> {
    const id = newId();
    const base = { v: 2 as const, id, from: this.handle, to: handle, pub: this.pub };
    if (PLAIN_TYPES.has(msg.type)) return { id, raw: JSON.stringify({ ...base, msg }) };
    const peerKey = this.handlers.getPeerKey(handle);
    if (!peerKey) return null; // never send profile data without a key
    const enc = await this.e2e.seal(peerKey, JSON.stringify(msg), `${id}|${this.handle}|${handle}`);
    return { id, raw: JSON.stringify({ ...base, enc }) };
  }

  /** Sends over the data channel when open, otherwise through the relay. */
  async send(handle: string, msg: Envelope): Promise<boolean> {
    const wire = await this.encode(handle, msg);
    if (!wire) return false;
    const channel = this.tunnels.get(handle)?.channel;
    if (channel?.readyState === "open") {
      try {
        channel.send(wire.raw);
        return true;
      } catch {
        /* fall back to the relay */
      }
    }
    if (!this.transport) return false;
    const room = await roomId(handle);
    return this.transport.send(room, wire.id, wire.raw, TTL[msg.type] ?? 24 * 3600);
  }

  /** Waits a few seconds for the network instead of failing at once. */
  async sendWithRetry(handle: string, msg: Envelope, seconds = 6) {
    for (let i = 0; i < seconds; i++) {
      if (this.transport?.isConnected()) return this.send(handle, msg);
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  }

  // ---------- WebRTC ----------

  private rtcAvailable() {
    return typeof RTCPeerConnection !== "undefined";
  }

  /** Waits for ICE gathering to complete, bounded by a timeout (non-trickle signaling). */
  private waitIce(pc: RTCPeerConnection) {
    if (pc.iceGatheringState === "complete") return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      };
      const check = () => {
        if (pc.iceGatheringState === "complete") done();
      };
      const timer = setTimeout(done, this.opts.iceTimeoutMs ?? 5000);
      pc.addEventListener("icegatheringstatechange", check);
    });
  }

  private newTunnel(handle: string, role: "offer" | "answer", nonce: string): Tunnel {
    this.closeTunnel(handle);
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const t: Tunnel = {
      pc,
      nonce,
      role,
      channel: null,
      // No open DataChannel in time: give up, the relay keeps carrying the data.
      timer: setTimeout(() => this.closeTunnel(handle, nonce), this.opts.tunnelTimeoutMs ?? 20_000),
    };
    pc.onconnectionstatechange = () => {
      recordEvent("p2p.state", { state: pc.connectionState });
      if (pc.connectionState === "failed" || pc.connectionState === "closed")
        this.closeTunnel(handle, nonce);
    };
    this.tunnels.set(handle, t);
    return t;
  }

  private wireChannel(handle: string, nonce: string, ch: RTCDataChannel) {
    ch.onopen = () => {
      const t = this.tunnels.get(handle);
      if (!t || t.nonce !== nonce) return ch.close();
      t.channel = ch;
      clearTimeout(t.timer);
      this.handlers.onTunnel?.(handle, true);
    };
    ch.onclose = () => this.closeTunnel(handle, nonce);
    ch.onmessage = (e) => void this.deliver(String(e.data));
  }

  private closeTunnel(handle: string, nonce?: string) {
    const t = this.tunnels.get(handle);
    if (!t || (nonce && t.nonce !== nonce)) return;
    this.tunnels.delete(handle);
    clearTimeout(t.timer);
    const wasOpen = t.channel?.readyState === "open";
    try {
      t.channel?.close();
      t.pc.close();
    } catch {
      /* ignore */
    }
    if (wasOpen || t.channel) this.handlers.onTunnel?.(handle, false);
  }

  /** The smaller handle offers, the other answers: avoids simultaneous offers (glare). */
  private isOfferer(peer: string) {
    return this.handle < peer;
  }

  /** Opens a direct data channel to a peer; falls back silently to the relay. */
  async upgrade(handle: string) {
    if (!this.rtcAvailable() || !this.handlers.getPeerKey(handle)) return;
    if (!this.isOfferer(handle) || this.tunnels.has(handle)) return;
    const nonce = newId();
    try {
      const t = this.newTunnel(handle, "offer", nonce);
      this.wireChannel(handle, nonce, t.pc.createDataChannel("questionar"));
      await t.pc.setLocalDescription(await t.pc.createOffer());
      await this.waitIce(t.pc);
      if (this.tunnels.get(handle)?.nonce !== nonce) return; // superseded
      const ok = await this.send(handle, {
        type: "offer",
        from: this.handle,
        sdp: t.pc.localDescription?.sdp ?? "",
        nonce,
      });
      if (!ok) this.closeTunnel(handle, nonce);
    } catch {
      this.closeTunnel(handle, nonce);
    }
  }

  private async answerOffer(msg: Extract<Envelope, { type: "offer" }>) {
    if (!this.rtcAvailable() || !msg.sdp) return;
    const nonce = msg.nonce ?? newId();
    const existing = this.tunnels.get(msg.from);
    if (existing && existing.nonce === nonce) return; // duplicate offer
    // Glare: if we are the designated offerer and have our own attempt, keep ours.
    if (existing && existing.role === "offer" && this.isOfferer(msg.from)) return;
    try {
      const t = this.newTunnel(msg.from, "answer", nonce);
      t.pc.ondatachannel = (e) => this.wireChannel(msg.from, nonce, e.channel);
      await t.pc.setRemoteDescription({ type: "offer", sdp: msg.sdp });
      await t.pc.setLocalDescription(await t.pc.createAnswer());
      await this.waitIce(t.pc);
      if (this.tunnels.get(msg.from)?.nonce !== nonce) return;
      const answer: Envelope = {
        type: "answer",
        from: this.handle,
        sdp: t.pc.localDescription?.sdp ?? "",
        ...(msg.nonce ? { nonce } : {}),
      };
      if (!(await this.send(msg.from, answer))) this.closeTunnel(msg.from, nonce);
    } catch {
      this.closeTunnel(msg.from, nonce);
    }
  }

  private async acceptAnswer(msg: Extract<Envelope, { type: "answer" }>) {
    const t = this.tunnels.get(msg.from);
    if (!t || t.role !== "offer" || (msg.nonce && msg.nonce !== t.nonce)) return; // stale
    if (t.pc.signalingState !== "have-local-offer") return; // duplicate or late
    try {
      await t.pc.setRemoteDescription({ type: "answer", sdp: msg.sdp });
    } catch {
      this.closeTunnel(msg.from, t.nonce);
    }
  }

  stop() {
    this.stopped = true;
    if (this.relayRetry) clearTimeout(this.relayRetry);
    this.relayRetry = null;
    this.transport?.stop();
    this.transport = null;
    for (const h of [...this.tunnels.keys()]) this.closeTunnel(h);
    this.presence.clear();
  }
}
