// Permanent P2P tunnel: presence and signalling ride on a free public MQTT room,
// the questionnaire itself is exchanged over a WebRTC data channel when it opens.

import mqtt, { type MqttClient } from "mqtt";

import type { ProfileSnapshot } from "./types";

const BROKERS = [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://test.mosquitto.org:8081/mqtt",
  "wss://broker.hivemq.com:8884/mqtt",
];

const ROOT = "questionar/v1";

export type Envelope =
  | { type: "hello"; from: string; name: string }
  | { type: "request"; from: string; name: string; snapshot: ProfileSnapshot }
  | { type: "accept"; from: string; name: string; snapshot: ProfileSnapshot }
  | { type: "reject"; from: string }
  | { type: "cancel"; from: string }
  | { type: "profile"; from: string; name: string; snapshot: ProfileSnapshot }
  | { type: "offer"; from: string; sdp: string }
  | { type: "answer"; from: string; sdp: string };

/** Stable room id for a handle (never exposes the handle itself). */
export async function roomId(handle: string): Promise<string> {
  const bytes = new TextEncoder().encode(`questionar:${handle}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type Handlers = {
  onMessage: (msg: Envelope) => void;
  onPresence: (room: string, online: boolean) => void;
  onStatus: (connected: boolean) => void;
};

export class P2P {
  private client: MqttClient | null = null;
  private brokerIndex = 0;
  private myRoom = "";
  private peerRooms = new Map<string, string>(); // room -> handle
  private channels = new Map<string, RTCDataChannel>();
  private peers = new Map<string, RTCPeerConnection>();
  private recent = new Map<string, number>();

  /** True when the exact same payload already arrived a moment ago (MQTT + data channel). */
  private isDuplicate(raw: string) {
    const now = Date.now();
    for (const [k, t] of this.recent) if (now - t > 15000) this.recent.delete(k);
    if (this.recent.has(raw)) return true;
    this.recent.set(raw, now);
    return false;
  }

  private deliver(raw: string) {
    if (this.isDuplicate(raw)) return;
    let msg: Envelope;
    try {
      msg = JSON.parse(raw) as Envelope;
    } catch {
      return;
    }
    if ("from" in msg && msg.from === this.handle) return;
    if (msg.type === "offer") void this.answerOffer(msg);
    else if (msg.type === "answer") void this.acceptAnswer(msg);
    else this.handlers.onMessage(msg);
  }

  constructor(
    private handle: string,
    private name: string,
    private handlers: Handlers,
  ) {}

  async start(peerHandles: string[]) {
    this.myRoom = await roomId(this.handle);
    for (const h of peerHandles) this.peerRooms.set(await roomId(h), h);
    this.connect();
  }

  private connect() {
    const url = BROKERS[this.brokerIndex % BROKERS.length]!;
    const client = mqtt.connect(url, {
      clientId: `qar_${Math.random().toString(16).slice(2)}`,
      reconnectPeriod: 4000,
      connectTimeout: 6000,
      keepalive: 30,
      clean: true,
      will: {
        topic: `${ROOT}/presence/${this.myRoom}`,
        payload: "0",
        qos: 0,
        retain: true,
      },
    });
    this.client = client;

    client.on("connect", () => {
      this.handlers.onStatus(true);
      client.subscribe([`${ROOT}/inbox/${this.myRoom}`, `${ROOT}/presence/+`]);
      client.publish(`${ROOT}/presence/${this.myRoom}`, "1", { retain: true });
    });

    client.on("message", (topic, payload) => {
      if (topic.startsWith(`${ROOT}/presence/`)) {
        const room = topic.split("/").pop()!;
        const handle = this.peerRooms.get(room);
        if (handle) this.handlers.onPresence(handle, payload.toString() === "1");
        return;
      }
      this.deliver(payload.toString());
    });

    client.on("error", () => {
      this.handlers.onStatus(false);
      this.brokerIndex++;
      client.end(true, () => this.connect());
    });
    client.on("close", () => this.handlers.onStatus(false));
  }

  async track(handle: string) {
    const room = await roomId(handle);
    this.peerRooms.set(room, handle);
  }

  /** Sends over the data channel when open, otherwise through the MQTT room. */
  async send(handle: string, msg: Envelope) {
    const channel = this.channels.get(handle);
    if (channel?.readyState === "open") {
      channel.send(JSON.stringify(msg));
      return;
    }
    const room = await roomId(handle);
    this.client?.publish(`${ROOT}/inbox/${room}`, JSON.stringify(msg));
  }

  /** Waits a few seconds for the other side to be reachable instead of failing at once. */
  async sendWithRetry(handle: string, msg: Envelope, seconds = 6) {
    for (let i = 0; i < seconds; i++) {
      if (this.client?.connected) {
        await this.send(handle, msg);
        return true;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  }

  /** Opens a direct data channel to a peer; falls back silently to MQTT. */
  async upgrade(handle: string) {
    if (this.peers.has(handle)) return;
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    this.peers.set(handle, pc);
    const channel = pc.createDataChannel("questionar");
    channel.onmessage = (e) => this.deliver(e.data as string);
    this.channels.set(handle, channel);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await new Promise((r) => setTimeout(r, 1200)); // let ICE gather
    await this.send(handle, {
      type: "offer",
      from: this.handle,
      sdp: pc.localDescription?.sdp ?? "",
    });
  }

  private async answerOffer(msg: Extract<Envelope, { type: "offer" }>) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    this.peers.set(msg.from, pc);
    pc.ondatachannel = (e) => {
      this.channels.set(msg.from, e.channel);
      e.channel.onmessage = (ev) => this.deliver(ev.data as string);
    };
    await pc.setRemoteDescription({ type: "offer", sdp: msg.sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await new Promise((r) => setTimeout(r, 1200));
    await this.send(msg.from, {
      type: "answer",
      from: this.handle,
      sdp: pc.localDescription?.sdp ?? "",
    });
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
    this.client?.publish(`${ROOT}/presence/${this.myRoom}`, "0", { retain: true });
    this.client?.end(true);
    this.client = null;
    for (const pc of this.peers.values()) pc.close();
    this.peers.clear();
    this.channels.clear();
  }
}
