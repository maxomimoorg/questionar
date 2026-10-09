// Presence and rendezvous ride on the Cloudflare relay (or, if the user opts in, on public
// MQTT brokers). Every message is end-to-end encrypted with the identity keys before it
// leaves the device; once both sides are online a direct WebRTC channel is attempted.

import { E2E, keyFingerprint, publicOnly, type Sealed } from "./e2e";
import type { KeyPairJwk } from "./keys";
import { MqttTransport, RELAY_URL, RelayTransport, type Transport } from "./transport";
import type { ProfileSnapshot } from "./types";

export type Envelope =
  | { type: "request"; from: string; name: string }
  | { type: "keyx"; from: string }
  | { type: "preview"; from: string; name: string; snapshot: ProfileSnapshot }
  | { type: "accept"; from: string; name: string; snapshot: ProfileSnapshot }
  | { type: "reject"; from: string }
  | { type: "cancel"; from: string }
  | { type: "profile"; from: string; name: string; snapshot: ProfileSnapshot }
  | { type: "offer"; from: string; sdp: string }
  | { type: "answer"; from: string; sdp: string };

/** Types that may travel unencrypted: they contain no profile data. */
const PLAIN_TYPES = new Set(["request", "keyx", "reject", "cancel"]);

type Wire = { v: 2; id: string; from: string; pub: JsonWebKey; msg?: Envelope; enc?: Sealed };

export type NetMode = "relay" | "mqtt" | "offline";

const ICE = [{ urls: "stun:stun.cloudflare.com:3478" }];
const TTL: Partial<Record<Envelope["type"], number>> = {
  request: 72 * 3600,
  offer: 120,
  answer: 120,
};

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
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");

type Handlers = {
  onMessage: (msg: Envelope) => void;
  onPresence: (handle: string, online: boolean) => void;
  onStatus: (connected: boolean, mode: NetMode) => void;
  /** Trust on first use: known public key for a handle, and a callback to remember a new one. */
  getPeerKey: (handle: string) => JsonWebKey | undefined;
  setPeerKey: (handle: string, key: JsonWebKey) => void;
  onKeyMismatch: (handle: string) => void;
};

export class P2P {
  private transport: Transport | null = null;
  private mode: NetMode = "offline";
  private myRoom = "";
  private peerRooms = new Map<string, string>(); // room -> handle
  private channels = new Map<string, RTCDataChannel>();
  private peers = new Map<string, RTCPeerConnection>();
  private seen = new Map<string, number>();
  private e2e: E2E;
  private pub: JsonWebKey;

  constructor(
    private handle: string,
    keys: KeyPairJwk,
    private handlers: Handlers,
    private mqttFallback: boolean,
  ) {
    this.e2e = new E2E(keys.privateKey);
    this.pub = publicOnly(keys.publicKey);
  }

  getMode() {
    return this.mode;
  }

  async start(peerHandles: string[]) {
    this.myRoom = await roomId(this.handle);
    for (const h of peerHandles) this.peerRooms.set(await roomId(h), h);
    if (this.transport) return; // already running
    if (RELAY_URL) this.use("relay");
    else this.use(this.mqttFallback ? "mqtt" : "offline");
  }

  private use(mode: NetMode) {
    this.transport?.stop();
    this.transport = null;
    this.mode = mode;
    const ev = {
      onWire: (raw: string) => void this.deliver(raw),
      onPresence: (room: string, online: boolean) => {
        const h = this.peerRooms.get(room);
        if (h) this.handlers.onPresence(h, online);
      },
      onStatus: (c: boolean) => this.handlers.onStatus(c, this.mode),
      onUnavailable: () => this.use(this.mqttFallback ? "mqtt" : "offline"),
    };
    if (mode === "relay") this.transport = new RelayTransport(RELAY_URL, ev);
    else if (mode === "mqtt") this.transport = new MqttTransport(ev);
    this.handlers.onStatus(false, mode);
    this.transport?.start(this.myRoom, [...this.peerRooms.keys()]);
  }

  private isDuplicate(id: string) {
    const now = Date.now();
    for (const [k, t] of this.seen) if (now - t > 10 * 60_000) this.seen.delete(k);
    if (this.seen.has(id)) return true;
    this.seen.set(id, now);
    return false;
  }

  private async deliver(raw: string) {
    let wire: Wire;
    try {
      wire = JSON.parse(raw) as Wire;
    } catch {
      return;
    }
    if (wire?.v !== 2 || typeof wire.id !== "string" || !wire.pub || wire.from === this.handle) return;
    if (this.isDuplicate(wire.id)) return;

    // Trust on first use: the first key seen for a handle is pinned.
    const known = this.handlers.getPeerKey(wire.from);
    if (known && keyFingerprint(known) !== keyFingerprint(wire.pub)) {
      this.handlers.onKeyMismatch(wire.from);
      return;
    }
    if (!known) this.handlers.setPeerKey(wire.from, publicOnly(wire.pub));

    let msg: Envelope;
    if (wire.enc) {
      try {
        msg = JSON.parse(await this.e2e.open(wire.pub, wire.enc, `${wire.id}|${wire.from}`)) as Envelope;
      } catch {
        return;
      }
    } else if (wire.msg && PLAIN_TYPES.has(wire.msg.type)) {
      msg = wire.msg;
    } else return;
    if (msg.from !== wire.from) return;

    if (msg.type === "offer") void this.answerOffer(msg);
    else if (msg.type === "answer") void this.acceptAnswer(msg);
    else this.handlers.onMessage(msg);
  }

  async track(handle: string) {
    const room = await roomId(handle);
    this.peerRooms.set(room, handle);
    this.transport?.watch(room);
  }

  private async encode(handle: string, msg: Envelope): Promise<{ id: string; raw: string } | null> {
    const id = newId();
    const base = { v: 2 as const, id, from: this.handle, pub: this.pub };
    if (PLAIN_TYPES.has(msg.type)) return { id, raw: JSON.stringify({ ...base, msg }) };
    const peerKey = this.handlers.getPeerKey(handle);
    if (!peerKey) return null; // never send profile data without a key
    const enc = await this.e2e.seal(peerKey, JSON.stringify(msg), `${id}|${this.handle}`);
    return { id, raw: JSON.stringify({ ...base, enc }) };
  }

  /** Sends over the data channel when open, otherwise through the relay. */
  async send(handle: string, msg: Envelope): Promise<boolean> {
    const wire = await this.encode(handle, msg);
    if (!wire) return false;
    const channel = this.channels.get(handle);
    if (channel?.readyState === "open") {
      channel.send(wire.raw);
      return true;
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

  /** Opens a direct data channel to a peer; falls back silently to the relay. */
  async upgrade(handle: string) {
    if (this.peers.has(handle) || !this.handlers.getPeerKey(handle)) return;
    const pc = new RTCPeerConnection({ iceServers: ICE });
    this.peers.set(handle, pc);
    const channel = pc.createDataChannel("questionar");
    channel.onmessage = (e) => void this.deliver(e.data as string);
    this.channels.set(handle, channel);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await new Promise((r) => setTimeout(r, 1200)); // let ICE gather
    await this.send(handle, { type: "offer", from: this.handle, sdp: pc.localDescription?.sdp ?? "" });
  }

  private async answerOffer(msg: Extract<Envelope, { type: "offer" }>) {
    this.peers.get(msg.from)?.close();
    const pc = new RTCPeerConnection({ iceServers: ICE });
    this.peers.set(msg.from, pc);
    pc.ondatachannel = (e) => {
      this.channels.set(msg.from, e.channel);
      e.channel.onmessage = (ev) => void this.deliver(ev.data as string);
    };
    await pc.setRemoteDescription({ type: "offer", sdp: msg.sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await new Promise((r) => setTimeout(r, 1200));
    await this.send(msg.from, { type: "answer", from: this.handle, sdp: pc.localDescription?.sdp ?? "" });
  }

  private async acceptAnswer(msg: Extract<Envelope, { type: "answer" }>) {
    const pc = this.peers.get(msg.from);
    if (!pc || pc.signalingState !== "have-local-offer") return;
    try {
      await pc.setRemoteDescription({ type: "answer", sdp: msg.sdp });
    } catch {
      /* duplicate or late answer */
    }
  }

  stop() {
    this.transport?.stop();
    this.transport = null;
    for (const pc of this.peers.values()) pc.close();
    this.peers.clear();
    this.channels.clear();
  }
}
